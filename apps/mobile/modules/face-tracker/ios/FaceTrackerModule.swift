import AVFoundation
import ExpoModulesCore

public class FaceTrackerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FaceTracker")

    // Resolves true when the camera may be used. The view itself never prompts.
    AsyncFunction("requestCameraPermissionAsync") { () async -> Bool in
      await AVCaptureDevice.requestAccess(for: .video)
    }

    // Landmarks of one face in a still photo, or nil when there is no face.
    AsyncFunction("detectFaceAsync") { (uri: URL) throws -> [String: Any]? in
      try detectFace(in: uri)
    }

    View(FaceTrackerView.self) {
      Events("onLandmarks", "onStatus")

      Prop("active") { (view: FaceTrackerView, active: Bool) in
        view.setActive(active)
      }
    }
  }
}
