import MediaPipeTasksVision
import UIKit

/// The model ships in the pod's resource bundle, which is copied into the app bundle.
func faceLandmarkerModelPath() throws -> String {
  let bundles = [Bundle(for: FaceTrackerView.self), Bundle.main]
  let modelPath = bundles.lazy
    .compactMap { $0.url(forResource: "FaceTrackerModel", withExtension: "bundle") }
    .compactMap { Bundle(url: $0)?.path(forResource: "face_landmarker", ofType: "task") }
    .first
  guard let modelPath else {
    throw FaceTrackerError.modelMissing
  }
  return modelPath
}

/// Finds one face in a still photo on device and returns its landmarks normalized to the upright
/// photo, or nil when there is no face. The photo never leaves the device.
func detectFace(in url: URL) throws -> [String: Any]? {
  // UIImage keeps the EXIF orientation, and MPImage passes it to MediaPipe.
  guard let image = UIImage(contentsOfFile: url.path) else {
    throw FaceTrackerError.imageUnreadable
  }
  let options = FaceLandmarkerOptions()
  options.baseOptions.modelAssetPath = try faceLandmarkerModelPath()
  options.runningMode = .image
  options.numFaces = 1
  let landmarker = try FaceLandmarker(options: options)
  let result = try landmarker.detect(image: try MPImage(uiImage: image))
  guard let face = result.faceLandmarks.first, !face.isEmpty else {
    return nil
  }
  var points: [Double] = []
  points.reserveCapacity(face.count * 2)
  for landmark in face {
    points.append(Double(landmark.x))
    points.append(Double(landmark.y))
  }
  return [
    "points": points,
    "width": Double(image.size.width * image.scale),
    "height": Double(image.size.height * image.scale),
  ]
}
