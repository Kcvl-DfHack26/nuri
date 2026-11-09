package expo.modules.facetracker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCase
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.MediaPipeException
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicInteger

// Shows the front camera and runs MediaPipe Face Landmarker (LIVE_STREAM) on its frames on device.
// Frames and landmarks never leave the device. Landmarks are sent to JavaScript normalized to the
// upright, unmirrored frame; the preview is mirrored, so JavaScript mirrors x to match it.
class FaceTrackerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // PreviewView lays out its own surface, which React Native does not do for native children.
  override val shouldUseAndroidLayout = true

  private val onLandmarks by EventDispatcher()
  private val onStatus by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    scaleType = PreviewView.ScaleType.FILL_CENTER
    // A SurfaceView hands camera frames straight to the compositor. A TextureView made the app's
    // render thread copy every frame, which made the whole screen stutter.
    implementationMode = PreviewView.ImplementationMode.PERFORMANCE
  }
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  // Preview and analysis share the aspect ratio so landmarks line up with the cropped preview.
  private val resolutionSelector = ResolutionSelector.Builder()
    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
    .build()
  private var cameraProvider: ProcessCameraProvider? = null
  // Main thread. The camera provider is shared by the whole app: stopping unbinds only these, and
  // starting takes the camera from any other view (see start()).
  private var useCases: Array<UseCase> = emptyArray()
  // Analysis thread only: MediaPipe's GPU delegate works only on the thread that created it, so the
  // landmarker is created, used, replaced and closed there.
  private var landmarker: FaceLandmarker? = null
  // Analysis thread only. Set when not even a CPU landmarker can be created, so it is not retried
  // on every frame.
  private var landmarkerUnavailable = false
  // Frames sent since the last result: counted on the analysis thread, reset on MediaPipe's thread.
  private val framesWithoutResult = AtomicInteger(0)
  @Volatile private var active = false
  @Volatile private var trackLandmarks = true
  @Volatile private var sessionGeneration = 0
  @Volatile private var discardResultsBeforeMs = 0L
  private var lastStatus: String? = null
  private var lastMessage: String? = null

  // The camera frame is independent of live tracking: a still-photo diagnosis can use it even
  // when MediaPipe misses a frame. Replacing it keeps only one bitmap in memory. It is kept as the
  // sensor delivered it; only a snapshot makes an upright copy.
  private class CameraFrame(
    val bitmap: Bitmap,
    val rotationDegrees: Int,
    val atMs: Long,
    val generation: Int
  )
  @Volatile private var latestFrame: CameraFrame? = null
  @Volatile private var frameGeometry: FrameGeometry? = null

  init {
    addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun setActive(value: Boolean) {
    active = value
    if (value) start() else stop()
  }

  fun setTrackLandmarks(value: Boolean) {
    trackLandmarks = value
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (active) start()
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    val analysis = useCases.filterIsInstance<ImageAnalysis>().firstOrNull() ?: return
    val rotation = display?.rotation ?: return
    if (analysis.targetRotation != rotation) {
      discardResultsBeforeMs = SystemClock.uptimeMillis()
      latestFrame = null
      analysis.targetRotation = rotation
      setStatus("noFace")
    }
  }

  override fun onDetachedFromWindow() {
    stop()
    runOnAnalysisThread { closeLandmarker() }
    super.onDetachedFromWindow()
  }

  // Called when React Native destroys the view. Each view owns its analysis thread, so stop it.
  fun release() {
    runOnAnalysisThread { closeLandmarker() }
    analysisExecutor.shutdown()
  }

  // Queued after any frame still being analyzed, so that frame finishes first. Work that arrives
  // after the view is destroyed is dropped.
  private fun runOnAnalysisThread(block: () -> Unit) {
    try {
      analysisExecutor.execute(block)
    } catch (error: RejectedExecutionException) {
      // The executor has been shut down by release().
    }
  }

  private fun start() {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      setStatus("permissionDenied")
      return
    }
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      setStatus("error", "カメラを開けませんでした")
      return
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!active || !isAttachedToWindow) return@addListener
      val preview = Preview.Builder()
        .setResolutionSelector(resolutionSelector)
        // The frame rate applies to the whole camera, so analysis gets 30 fps too. Without it some
        // cameras (the emulator's included) settle at 15 fps. CameraX picks the closest supported range.
        .setTargetFrameRate(TARGET_FRAME_RATE)
        .build()
      preview.setSurfaceProvider(previewView.surfaceProvider)
      val analysis = ImageAnalysis.Builder()
        .setTargetRotation(display?.rotation ?: Surface.ROTATION_0)
        .setResolutionSelector(resolutionSelector)
        // MediaPipe's LIVE_STREAM mode drops frames it cannot keep up with; keep only the latest here too.
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .build()
      val generation = sessionGeneration
      analysis.setAnalyzer(analysisExecutor) { image -> analyze(image, generation) }
      try {
        val provider = future.get()
        cameraProvider = provider
        // Navigating from ⑦ to ⑩ starts the new screen's camera before the old screen's stops. Both
        // share the activity's camera, and two previews plus two analyses exceed what it can bind,
        // so the screen that starts last takes the camera.
        provider.unbindAll()
        useCases = arrayOf(preview, analysis)
        provider.bindToLifecycle(owner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, analysis)
      } catch (error: Exception) {
        setStatus("error", "前面カメラを使えません")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stop() {
    sessionGeneration++
    discardResultsBeforeMs = SystemClock.uptimeMillis()
    cameraProvider?.unbind(*useCases)
    useCases = emptyArray()
    latestFrame = null
    // A resumed camera must report its first state even when it matches the previous session.
    lastStatus = null
    lastMessage = null
  }

  /**
   * Saves the current frame as a mirrored JPEG in the app's cache, or null before a frame arrives.
   * JavaScript deletes the file once it is no longer shown. Nothing is sent anywhere.
   */
  fun snapshot(): String? {
    val latest = latestFrame
      ?.takeIf {
        active && it.generation == sessionGeneration &&
          SystemClock.uptimeMillis() - it.atMs <= SNAPSHOT_MAX_AGE_MS
      }
      ?: return null
    val sensor = latest.bitmap
    // Upright first, then mirrored like the preview.
    val transform = Matrix().apply {
      postRotate(latest.rotationDegrees.toFloat())
      postScale(-1f, 1f)
    }
    val frame = Bitmap.createBitmap(sensor, 0, 0, sensor.width, sensor.height, transform, true)
    val folder = File(context.cacheDir, "face-tracker").apply { mkdirs() }
    val file = File(folder, "${UUID.randomUUID()}.jpg")
    file.outputStream().use { frame.compress(Bitmap.CompressFormat.JPEG, 85, it) }
    return Uri.fromFile(file).toString()
  }

  // Analysis thread.
  private fun openLandmarker(): FaceLandmarker? {
    if (landmarkerUnavailable) {
      return null
    }
    landmarker = try {
      createLandmarker()
    } catch (error: Exception) {
      landmarkerUnavailable = true
      post { setStatus("error", error.message ?: "顔追跡を始められませんでした") }
      null
    }
    return landmarker
  }

  // Analysis thread. The GPU keeps inference short enough to follow head movement; fall back to
  // the CPU on devices whose GPU MediaPipe cannot use.
  private fun createLandmarker(): FaceLandmarker {
    if (!gpuFailed) {
      try {
        return createLandmarker(Delegate.GPU)
      } catch (error: Exception) {
        gpuFailed = true
      }
    }
    return createLandmarker(Delegate.CPU)
  }

  // Analysis thread. A GPU can open and still fail on every frame (the emulator's GL does), so the
  // first error from a GPU landmarker switches to the CPU. Errors from a landmarker that has
  // already been replaced are ignored.
  private fun onLandmarkerError(failed: FaceLandmarker, error: RuntimeException) {
    if (failed !== landmarker) {
      return
    }
    if (gpuFailed) {
      post { setStatus("error", error.message ?: "顔追跡に失敗しました") }
      return
    }
    gpuFailed = true
    framesWithoutResult.set(0)
    closeQuietly(failed)
    landmarker = null
    openLandmarker()
  }

  // Analysis thread.
  private fun closeLandmarker() {
    landmarker?.let { closeQuietly(it) }
    landmarker = null
  }

  private fun closeQuietly(closing: FaceLandmarker) {
    try {
      closing.close()
    } catch (error: MediaPipeException) {
      // Closing a graph that has failed throws its error again; the failure is already handled.
    }
  }

  private fun createLandmarker(delegate: Delegate): FaceLandmarker {
    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("face_landmarker.task")
      .setDelegate(delegate)
      .build()
    // The error listener needs the landmarker it belongs to, which exists only after it is built.
    var created: FaceLandmarker? = null
    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumFaces(1)
      .setResultListener { result, _ -> onResult(result) }
      .setErrorListener { error -> runOnAnalysisThread { created?.let { onLandmarkerError(it, error) } } }
      .build()
    return FaceLandmarker.createFromOptions(context, options).also { created = it }
  }

  // Analysis thread.
  private fun analyze(image: ImageProxy, generation: Int) {
    if (!active || generation != sessionGeneration) {
      image.close()
      return
    }
    // Monotonic, so it is both the LIVE_STREAM timestamp and the capture time for the delay.
    val timestamp = SystemClock.uptimeMillis()
    // Without live tracking the frame is only kept for a snapshot, which does not need every frame.
    val previous = latestFrame
    val recentFrameKept = previous != null && previous.generation == generation &&
      timestamp - previous.atMs < SNAPSHOT_ONLY_FRAME_INTERVAL_MS
    if (!trackLandmarks && recentFrameKept) {
      image.close()
      return
    }
    val rotation = image.imageInfo.rotationDegrees
    val bitmap = image.toBitmap()
    image.close()
    val geometry = geometryFor(bitmap.width, bitmap.height, rotation, timestamp)
    if (!active || generation != sessionGeneration) return
    latestFrame = CameraFrame(bitmap, rotation, timestamp, generation)
    if (!trackLandmarks) return
    val current = landmarker ?: openLandmarker() ?: return
    // MediaPipe only logs GPU graph errors that happen while frames are sent, so a GPU landmarker
    // that returns nothing for many frames is treated as failed.
    val gpuSilent = !gpuFailed && framesWithoutResult.incrementAndGet() > GPU_SILENT_FRAME_LIMIT
    if (gpuSilent) {
      onLandmarkerError(current, IllegalStateException("GPU returned no results"))
      return
    }
    try {
      // MediaPipe rotates the frame itself, so no rotated copy is made for each frame.
      current.detectAsync(BitmapImageBuilder(bitmap).build(), geometry.options, timestamp)
    } catch (error: MediaPipeException) {
      onLandmarkerError(current, error)
    }
  }

  // Analysis thread. Replaced only when the frames change, so every result can be matched with
  // the geometry of the frame it came from.
  private fun geometryFor(sensorWidth: Int, sensorHeight: Int, rotation: Int, timestamp: Long): FrameGeometry {
    val current = frameGeometry
    if (current != null && current.matches(sensorWidth, sensorHeight, rotation)) {
      return current
    }
    Log.i(TAG, "Analysis frames are ${sensorWidth}x$sensorHeight, rotated $rotation degrees")
    return FrameGeometry(sensorWidth, sensorHeight, rotation, timestamp).also { frameGeometry = it }
  }

  // MediaPipe's thread.
  private fun onResult(result: FaceLandmarkerResult) {
    if (result.timestampMs() <= discardResultsBeforeMs) return
    // A result from before the frames changed size or rotation would be turned the wrong way.
    val geometry = frameGeometry ?: return
    if (result.timestampMs() < geometry.sinceMs) return
    framesWithoutResult.set(0)
    val face = result.faceLandmarks().firstOrNull()
    if (face.isNullOrEmpty()) {
      post {
        if (result.timestampMs() > discardResultsBeforeMs) setStatus("noFace")
      }
      return
    }
    val points = ArrayList<Double>(face.size * 2)
    for (landmark in face) {
      geometry.addUpright(points, landmark.x().toDouble(), landmark.y().toDouble())
    }
    val latencyMs = (SystemClock.uptimeMillis() - result.timestampMs()).toDouble()
    val width = geometry.width.toDouble()
    val height = geometry.height.toDouble()
    post {
      if (!active || !isAttachedToWindow || result.timestampMs() <= discardResultsBeforeMs) return@post
      setStatus("tracking")
      onLandmarks(mapOf("points" to points, "width" to width, "height" to height, "latencyMs" to latencyMs))
    }
  }

  // Main thread. Only sends changes, so a steady state does not flood JavaScript.
  private fun setStatus(status: String, message: String? = null) {
    if (!active || !isAttachedToWindow) return
    if (status == lastStatus && message == lastMessage) return
    lastStatus = status
    lastMessage = message
    onStatus(if (message == null) mapOf("status" to status) else mapOf("status" to status, "message" to message))
  }

  // The analyzed frames as the sensor delivers them, and the clockwise rotation (CameraX's
  // rotationDegrees) that makes them upright.
  private class FrameGeometry(
    private val sensorWidth: Int,
    private val sensorHeight: Int,
    private val rotationDegrees: Int,
    /** When frames with this geometry began; earlier results belong to the previous one. */
    val sinceMs: Long
  ) {
    private val sideways = rotationDegrees == 90 || rotationDegrees == 270
    val width = if (sideways) sensorHeight else sensorWidth
    val height = if (sideways) sensorWidth else sensorHeight
    val options: ImageProcessingOptions =
      ImageProcessingOptions.builder().setRotationDegrees(rotationDegrees).build()

    fun matches(otherWidth: Int, otherHeight: Int, otherRotation: Int) =
      sensorWidth == otherWidth && sensorHeight == otherHeight && rotationDegrees == otherRotation

    // MediaPipe finds the face in the frame rotated by `options`, but returns the landmarks
    // normalized to the frame it was given. This turns them clockwise into the upright frame, as
    // rotating the frame itself did.
    fun addUpright(points: MutableList<Double>, x: Double, y: Double) {
      when (rotationDegrees) {
        90 -> {
          points.add(1 - y)
          points.add(x)
        }
        180 -> {
          points.add(1 - x)
          points.add(1 - y)
        }
        270 -> {
          points.add(y)
          points.add(1 - x)
        }
        else -> {
          points.add(x)
          points.add(y)
        }
      }
    }
  }

  private companion object {
    const val TAG = "FaceTracker"
    // Whether the GPU works is a property of the device, so once it fails, every later
    // landmarker in the app uses the CPU instead of waiting for the GPU again.
    @Volatile var gpuFailed = false
    // PoC-1 target in docs/requirements.md (chapter 11).
    val TARGET_FRAME_RATE = Range(30, 30)
    // About 5 s at 30 fps: long enough for a GPU to prepare its first result, while a slow but
    // working GPU (the emulator's, about 0.5 s per result) answers within a dozen frames.
    const val GPU_SILENT_FRAME_LIMIT = 150
    // Do not save a frozen preview after the camera stops delivering frames.
    const val SNAPSHOT_MAX_AGE_MS = 1500L
    // How often a frame is converted while only snapshots need it: 4 a second instead of 30, so a
    // snapshot is at most about this old, well within SNAPSHOT_MAX_AGE_MS.
    const val SNAPSHOT_ONLY_FRAME_INTERVAL_MS = 250L
  }
}
