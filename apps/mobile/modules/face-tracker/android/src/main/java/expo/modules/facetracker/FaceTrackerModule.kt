package expo.modules.facetracker

import android.Manifest
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FaceTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FaceTracker")

    // Resolves true when the camera may be used. The view itself never prompts.
    AsyncFunction("requestCameraPermissionAsync") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      permissions.askForPermissions(
        { result -> promise.resolve(result[Manifest.permission.CAMERA]?.status == PermissionsStatus.GRANTED) },
        Manifest.permission.CAMERA
      )
    }

    // Landmarks of one face in a still photo, or null when there is no face.
    AsyncFunction("detectFaceAsync") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      detectFace(context, Uri.parse(uri))
    }

    View(FaceTrackerView::class) {
      Events("onLandmarks", "onStatus")

      Prop("active") { view: FaceTrackerView, active: Boolean ->
        view.setActive(active)
      }

      Prop("trackLandmarks") { view: FaceTrackerView, enabled: Boolean ->
        view.setTrackLandmarks(enabled)
      }

      // The current frame as a JPEG file URI in the app's cache, or null before a frame arrives.
      AsyncFunction("takeSnapshotAsync") { view: FaceTrackerView ->
        view.snapshot()
      }

      OnViewDestroys { view: FaceTrackerView ->
        view.release()
      }
    }
  }
}
