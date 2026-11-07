package expo.modules.facetracker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

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
    // A TextureView keeps the preview inside React Native's view hierarchy for clipping and overlays.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  // Preview and analysis share the aspect ratio so landmarks line up with the cropped preview.
  private val resolutionSelector = ResolutionSelector.Builder()
    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
    .build()
  private var cameraProvider: ProcessCameraProvider? = null
  private var landmarker: FaceLandmarker? = null
  private var active = false
  private var lastStatus: String? = null

  @Volatile private var frameWidth = 0
  @Volatile private var frameHeight = 0

  init {
    addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun setActive(value: Boolean) {
    active = value
    if (value) start() else stop()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (active) start()
  }

  override fun onDetachedFromWindow() {
    stop()
    landmarker?.close()
    landmarker = null
    super.onDetachedFromWindow()
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
    if (landmarker == null) {
      landmarker = try {
        createLandmarker()
      } catch (error: Exception) {
        setStatus("error", error.message ?: "顔追跡を始められませんでした")
        return
      }
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!active || !isAttachedToWindow) return@addListener
      val provider = future.get()
      cameraProvider = provider
      val preview = Preview.Builder()
        .setResolutionSelector(resolutionSelector)
        .build()
      preview.setSurfaceProvider(previewView.surfaceProvider)
      val analysis = ImageAnalysis.Builder()
        .setResolutionSelector(resolutionSelector)
        // MediaPipe's LIVE_STREAM mode drops frames it cannot keep up with; keep only the latest here too.
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .build()
      analysis.setAnalyzer(analysisExecutor) { image -> analyze(image) }
      try {
        provider.unbindAll()
        provider.bindToLifecycle(owner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, analysis)
      } catch (error: Exception) {
        setStatus("error", "前面カメラを使えません")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stop() {
    cameraProvider?.unbindAll()
  }

  private fun createLandmarker(): FaceLandmarker {
    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetPath("face_landmarker.task").build())
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumFaces(1)
      .setResultListener { result, _ -> onResult(result) }
      .setErrorListener { error -> post { setStatus("error", error.message ?: "顔追跡に失敗しました") } }
      .build()
    return FaceLandmarker.createFromOptions(context, options)
  }

  // Analysis thread.
  private fun analyze(image: ImageProxy) {
    val current = landmarker
    if (current == null) {
      image.close()
      return
    }
    // Monotonic, so it is both the LIVE_STREAM timestamp and the capture time for the delay.
    val timestamp = SystemClock.uptimeMillis()
    val rotation = image.imageInfo.rotationDegrees
    val bitmap = image.toBitmap()
    image.close()
    val upright = if (rotation == 0) {
      bitmap
    } else {
      val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
      Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }
    frameWidth = upright.width
    frameHeight = upright.height
    current.detectAsync(BitmapImageBuilder(upright).build(), timestamp)
  }

  // MediaPipe's thread.
  private fun onResult(result: FaceLandmarkerResult) {
    val face = result.faceLandmarks().firstOrNull()
    if (face.isNullOrEmpty()) {
      post { setStatus("noFace") }
      return
    }
    val points = ArrayList<Double>(face.size * 2)
    for (landmark in face) {
      points.add(landmark.x().toDouble())
      points.add(landmark.y().toDouble())
    }
    val latencyMs = (SystemClock.uptimeMillis() - result.timestampMs()).toDouble()
    val width = frameWidth.toDouble()
    val height = frameHeight.toDouble()
    post {
      setStatus("tracking")
      onLandmarks(mapOf("points" to points, "width" to width, "height" to height, "latencyMs" to latencyMs))
    }
  }

  // Main thread. Only sends changes, so a steady state does not flood JavaScript.
  private fun setStatus(status: String, message: String? = null) {
    if (status == lastStatus && message == null) return
    lastStatus = status
    onStatus(if (message == null) mapOf("status" to status) else mapOf("status" to status, "message" to message))
  }
}
