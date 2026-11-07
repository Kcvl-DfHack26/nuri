package expo.modules.facetracker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import expo.modules.kotlin.exception.CodedException

// Photos are scaled down before detection; the landmarker resizes its input to a small size anyway.
private const val MAX_SIDE = 1280

internal class ImageUnreadableException : CodedException("写真を読み込めませんでした")

/**
 * Finds one face in a still photo on device and returns its landmarks normalized to the upright
 * photo, or null when there is no face. The photo never leaves the device.
 */
internal fun detectFace(context: Context, uri: Uri): Map<String, Any>? {
  val bitmap = readUpright(context, uri)
  val options = FaceLandmarker.FaceLandmarkerOptions.builder()
    .setBaseOptions(BaseOptions.builder().setModelAssetPath("face_landmarker.task").build())
    .setRunningMode(RunningMode.IMAGE)
    .setNumFaces(1)
    .build()
  val landmarker = FaceLandmarker.createFromOptions(context, options)
  try {
    val face = landmarker.detect(BitmapImageBuilder(bitmap).build()).faceLandmarks().firstOrNull()
    if (face.isNullOrEmpty()) return null
    val points = ArrayList<Double>(face.size * 2)
    for (landmark in face) {
      points.add(landmark.x().toDouble())
      points.add(landmark.y().toDouble())
    }
    return mapOf("points" to points, "width" to bitmap.width.toDouble(), "height" to bitmap.height.toDouble())
  } finally {
    landmarker.close()
  }
}

private fun readUpright(context: Context, uri: Uri): Bitmap {
  val resolver = context.contentResolver
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw ImageUnreadableException()
  var sample = 1
  while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
  val decoded = resolver.openInputStream(uri)?.use {
    BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
  } ?: throw ImageUnreadableException()
  val orientation = resolver.openInputStream(uri)?.use {
    ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
  } ?: ExifInterface.ORIENTATION_NORMAL
  val degrees = when (orientation) {
    ExifInterface.ORIENTATION_ROTATE_90 -> 90f
    ExifInterface.ORIENTATION_ROTATE_180 -> 180f
    ExifInterface.ORIENTATION_ROTATE_270 -> 270f
    else -> 0f
  }
  if (degrees == 0f) return decoded
  val matrix = Matrix().apply { postRotate(degrees) }
  return Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
}
