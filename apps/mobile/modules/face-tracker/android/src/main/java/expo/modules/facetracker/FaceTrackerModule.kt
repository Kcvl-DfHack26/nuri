package expo.modules.facetracker

import android.Manifest
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

    View(FaceTrackerView::class) {
      Events("onLandmarks", "onStatus")

      Prop("active") { view: FaceTrackerView, active: Boolean ->
        view.setActive(active)
      }

      OnViewDestroys { view: FaceTrackerView ->
        view.release()
      }
    }
  }
}
