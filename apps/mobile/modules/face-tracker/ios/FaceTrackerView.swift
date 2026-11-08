import AVFoundation
import CoreImage
import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

// Shows the front camera and runs MediaPipe Face Landmarker (LIVE_STREAM) on its frames on device.
// Frames and landmarks never leave the device. Landmarks are sent to JavaScript normalized to the
// upright, unmirrored frame; the preview is mirrored, so JavaScript mirrors x to match it.
class FaceTrackerView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate,
  FaceLandmarkerLiveStreamDelegate
{
  let onLandmarks = EventDispatcher()
  let onStatus = EventDispatcher()

  private let session = AVCaptureSession()
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let sessionQueue = DispatchQueue(label: "com.kcvl.nuri.facetracker.session")
  private let videoQueue = DispatchQueue(label: "com.kcvl.nuri.facetracker.video")
  private var landmarker: FaceLandmarker?
  private var configured = false
  private var videoOutput: AVCaptureVideoDataOutput?
  private var orientation: AVCaptureVideoOrientation = .portrait
  private var active = false
  private var lastStatus: String?
  private var lastMessage: String?

  // Shared between the video queue and MediaPipe's callback thread.
  private let lock = NSLock()
  private var sessionGeneration = 0
  private var acceptingFrames = false
  private var captures: [
    Int: (at: CFTimeInterval, generation: Int, size: CGSize, orientation: AVCaptureVideoOrientation)
  ] = [:]
  // Frames sent to MediaPipe by timestamp, and the one whose landmarks were sent last, kept only so
  // a snapshot shows the same frame that was diagnosed. Few are kept: held buffers stop the camera.
  private var pendingBuffers: [Int: CVPixelBuffer] = [:]
  private var landmarkedBuffer: CVPixelBuffer?
  private var lastTimestamp = -1

  required init(appContext: AppContext? = nil) {
    previewLayer = AVCaptureVideoPreviewLayer(session: session)
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
  }

  deinit {
    session.stopRunning()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
    updateOrientation()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      stop()
    } else if active {
      start()
    }
  }

  func setActive(_ value: Bool) {
    active = value
    if value {
      start()
    } else {
      stop()
    }
  }

  private func start() {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitStatus("permissionDenied")
      return
    }
    updateOrientation()
    let targetOrientation = orientation
    lock.lock()
    let generation = sessionGeneration
    lock.unlock()
    sessionQueue.async {
      if !self.configured && !self.configure(targetOrientation) {
        return
      }
      if !self.session.isRunning {
        self.session.startRunning()
      }
      self.lock.lock()
      if self.sessionGeneration == generation {
        self.acceptingFrames = true
      }
      self.lock.unlock()
    }
  }

  private func stop() {
    lock.lock()
    acceptingFrames = false
    sessionGeneration += 1
    captures.removeAll()
    pendingBuffers.removeAll()
    landmarkedBuffer = nil
    lock.unlock()
    // A resumed camera must report its first state even when it matches the previous session.
    lastStatus = nil
    lastMessage = nil
    sessionQueue.async {
      if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  private func updateOrientation() {
    guard let interfaceOrientation = window?.windowScene?.interfaceOrientation else { return }
    let next: AVCaptureVideoOrientation
    switch interfaceOrientation {
    case .portrait: next = .portrait
    case .portraitUpsideDown: next = .portraitUpsideDown
    case .landscapeLeft: next = .landscapeLeft
    case .landscapeRight: next = .landscapeRight
    default: return
    }
    guard next != orientation else { return }
    orientation = next
    orient(previewLayer.connection, to: next)
    sessionQueue.async {
      self.orient(self.videoOutput?.connection(with: .video), to: next)
      self.lock.lock()
      self.captures.removeAll()
      self.pendingBuffers.removeAll()
      self.landmarkedBuffer = nil
      self.lock.unlock()
    }
  }

  // Use the same interface orientation for the preview and the buffers fed to MediaPipe.
  private func orient(_ connection: AVCaptureConnection?, to orientation: AVCaptureVideoOrientation) {
    guard let connection, connection.isVideoOrientationSupported else { return }
    connection.videoOrientation = orientation
  }

  // Runs on the session queue.
  private func configure(_ orientation: AVCaptureVideoOrientation) -> Bool {
    do {
      landmarker = try makeLandmarker()
    } catch {
      emitStatus("error", message: error.localizedDescription)
      return false
    }
    session.beginConfiguration()
    defer { session.commitConfiguration() }
    if session.canSetSessionPreset(.hd1280x720) {
      session.sessionPreset = .hd1280x720
    }
    guard
      let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
      let input = try? AVCaptureDeviceInput(device: device),
      session.canAddInput(input)
    else {
      emitStatus("error", message: "前面カメラを使えません")
      return false
    }
    session.addInput(input)
    let output = AVCaptureVideoDataOutput()
    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    // MediaPipe's LIVE_STREAM mode drops frames it cannot keep up with; drop late ones here too.
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(self, queue: videoQueue)
    guard session.canAddOutput(output) else {
      emitStatus("error", message: "カメラの映像を読み取れません")
      return false
    }
    session.addOutput(output)
    videoOutput = output
    if let connection = output.connection(with: .video) {
      orient(connection, to: orientation)
      if connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = false
      }
    }
    DispatchQueue.main.async {
      self.orient(self.previewLayer.connection, to: self.orientation)
    }
    configured = true
    return true
  }

  private func makeLandmarker() throws -> FaceLandmarker {
    let options = FaceLandmarkerOptions()
    options.baseOptions.modelAssetPath = try faceLandmarkerModelPath()
    options.runningMode = .liveStream
    options.numFaces = 1
    options.faceLandmarkerLiveStreamDelegate = self
    return try FaceLandmarker(options: options)
  }

  /// Saves the frame of the landmarks sent last as a JPEG in the app's caches and returns its file
  /// URL, or nil when no face was found yet. It is mirrored like the preview, so it looks as the
  /// person saw it. Older snapshots are deleted once it is written, so at most one stays on the
  /// device. Nothing is sent anywhere.
  func snapshot() throws -> String? {
    lock.lock()
    let pixelBuffer = landmarkedBuffer
    lock.unlock()
    guard let pixelBuffer else {
      return nil
    }
    let mirrored = CIImage(cvPixelBuffer: pixelBuffer).oriented(.upMirrored)
    guard let image = CIContext().createCGImage(mirrored, from: mirrored.extent),
      let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.85)
    else {
      return nil
    }
    let manager = FileManager.default
    let folder = manager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("face-tracker", isDirectory: true)
    try manager.createDirectory(at: folder, withIntermediateDirectories: true)
    let file = folder.appendingPathComponent("\(UUID().uuidString).jpg")
    try data.write(to: file)
    for old in (try? manager.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    where old.lastPathComponent != file.lastPathComponent {
      try? manager.removeItem(at: old)
    }
    return file.absoluteString
  }

  // MARK: Camera frames (video queue)

  func captureOutput(
    _ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard let landmarker, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      return
    }
    let presentation = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let timestamp = Int(CMTimeGetSeconds(presentation) * 1000)
    guard let image = try? MPImage(sampleBuffer: sampleBuffer, orientation: .up) else {
      return
    }
    lock.lock()
    guard acceptingFrames else {
      lock.unlock()
      return
    }
    // LIVE_STREAM needs strictly increasing timestamps.
    guard timestamp > lastTimestamp else {
      lock.unlock()
      return
    }
    lastTimestamp = timestamp
    let generation = sessionGeneration
    let size = CGSize(
      width: CVPixelBufferGetWidth(pixelBuffer), height: CVPixelBufferGetHeight(pixelBuffer))
    captures[timestamp] = (CACurrentMediaTime(), generation, size, connection.videoOrientation)
    if captures.count > 30 {
      captures = captures.filter { $0.key > timestamp - 2000 }
    }
    pendingBuffers[timestamp] = pixelBuffer
    if pendingBuffers.count > 2, let oldest = pendingBuffers.keys.min() {
      pendingBuffers.removeValue(forKey: oldest)
    }
    lock.unlock()
    do {
      try landmarker.detectAsync(image: image, timestampInMilliseconds: timestamp)
    } catch {
      emitStatus("error", message: error.localizedDescription, generation: generation)
    }
  }

  // MARK: MediaPipe results (MediaPipe's thread)

  func faceLandmarker(
    _ faceLandmarker: FaceLandmarker, didFinishDetection result: FaceLandmarkerResult?,
    timestampInMilliseconds: Int, error: Error?
  ) {
    lock.lock()
    let capture = captures.removeValue(forKey: timestampInMilliseconds)
    let frame = pendingBuffers.removeValue(forKey: timestampInMilliseconds)
    pendingBuffers = pendingBuffers.filter { $0.key > timestampInMilliseconds }
    let hasFace = !(result?.faceLandmarks.first?.isEmpty ?? true)
    landmarkedBuffer = hasFace ? frame : nil
    lock.unlock()
    guard let capture else {
      return
    }
    if let error {
      emitStatus("error", message: error.localizedDescription, generation: capture.generation)
      return
    }
    guard let face = result?.faceLandmarks.first, !face.isEmpty else {
      emitStatus("noFace", generation: capture.generation)
      return
    }
    var points: [Double] = []
    points.reserveCapacity(face.count * 2)
    for landmark in face {
      points.append(Double(landmark.x))
      points.append(Double(landmark.y))
    }
    let latencyMs = (CACurrentMediaTime() - capture.at) * 1000
    DispatchQueue.main.async {
      guard self.active, self.window != nil, self.isCurrentSession(capture.generation),
        self.orientation == capture.orientation
      else {
        return
      }
      self.setStatus("tracking", message: nil)
      self.onLandmarks([
        "points": points,
        "width": Double(capture.size.width),
        "height": Double(capture.size.height),
        "latencyMs": latencyMs,
      ])
    }
  }

  // MARK: Status

  private func emitStatus(_ status: String, message: String? = nil, generation: Int? = nil) {
    DispatchQueue.main.async {
      if let generation, !self.isCurrentSession(generation) {
        return
      }
      self.setStatus(status, message: message)
    }
  }

  private func isCurrentSession(_ generation: Int) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return sessionGeneration == generation
  }

  // Main thread. Only sends changes, so a steady state does not flood JavaScript.
  private func setStatus(_ status: String, message: String?) {
    guard active, window != nil else {
      return
    }
    guard status != lastStatus || message != lastMessage else {
      return
    }
    lastStatus = status
    lastMessage = message
    var payload: [String: Any] = ["status": status]
    if let message {
      payload["message"] = message
    }
    onStatus(payload)
  }
}

enum FaceTrackerError: LocalizedError {
  case modelMissing
  case imageUnreadable

  var errorDescription: String? {
    switch self {
    case .modelMissing:
      return "顔追跡のモデルが見つかりません"
    case .imageUnreadable:
      return "写真を読み込めませんでした"
    }
  }
}
