import AVFoundation
import ExpoModulesCore
import MediaPipeTasksVision

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
  private var active = false
  private var lastStatus: String?
  private var lastMessage: String?

  // Shared between the video queue and MediaPipe's callback thread.
  private let lock = NSLock()
  private var captureTimes: [Int: CFTimeInterval] = [:]
  private var frameSize = CGSize.zero
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
    sessionQueue.async {
      if !self.configured && !self.configure() {
        return
      }
      if !self.session.isRunning {
        self.session.startRunning()
      }
    }
  }

  private func stop() {
    // A resumed camera must report its first state even when it matches the previous session.
    lastStatus = nil
    lastMessage = nil
    sessionQueue.async {
      if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  // Runs on the session queue.
  private func configure() -> Bool {
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
    if let connection = output.connection(with: .video) {
      // Upright portrait frames, not mirrored.
      if #available(iOS 17.0, *) {
        if connection.isVideoRotationAngleSupported(90) {
          connection.videoRotationAngle = 90
        }
      } else if connection.isVideoOrientationSupported {
        connection.videoOrientation = .portrait
      }
      if connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = false
      }
    }
    configured = true
    return true
  }

  private func makeLandmarker() throws -> FaceLandmarker {
    // The pod's resource bundle is copied into the app bundle.
    let bundles = [Bundle(for: FaceTrackerView.self), Bundle.main]
    let modelPath = bundles.lazy
      .compactMap { $0.url(forResource: "FaceTrackerModel", withExtension: "bundle") }
      .compactMap { Bundle(url: $0)?.path(forResource: "face_landmarker", ofType: "task") }
      .first
    guard let modelPath else {
      throw FaceTrackerError.modelMissing
    }
    let options = FaceLandmarkerOptions()
    options.baseOptions.modelAssetPath = modelPath
    options.runningMode = .liveStream
    options.numFaces = 1
    options.faceLandmarkerLiveStreamDelegate = self
    return try FaceLandmarker(options: options)
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
    // LIVE_STREAM needs strictly increasing timestamps.
    guard timestamp > lastTimestamp else {
      lock.unlock()
      return
    }
    lastTimestamp = timestamp
    frameSize = CGSize(
      width: CVPixelBufferGetWidth(pixelBuffer), height: CVPixelBufferGetHeight(pixelBuffer))
    captureTimes[timestamp] = CACurrentMediaTime()
    if captureTimes.count > 30 {
      captureTimes = captureTimes.filter { $0.key > timestamp - 2000 }
    }
    lock.unlock()
    do {
      try landmarker.detectAsync(image: image, timestampInMilliseconds: timestamp)
    } catch {
      emitStatus("error", message: error.localizedDescription)
    }
  }

  // MARK: MediaPipe results (MediaPipe's thread)

  func faceLandmarker(
    _ faceLandmarker: FaceLandmarker, didFinishDetection result: FaceLandmarkerResult?,
    timestampInMilliseconds: Int, error: Error?
  ) {
    lock.lock()
    let capturedAt = captureTimes.removeValue(forKey: timestampInMilliseconds)
    let size = frameSize
    lock.unlock()
    if let error {
      emitStatus("error", message: error.localizedDescription)
      return
    }
    guard let face = result?.faceLandmarks.first, !face.isEmpty else {
      emitStatus("noFace")
      return
    }
    var points: [Double] = []
    points.reserveCapacity(face.count * 2)
    for landmark in face {
      points.append(Double(landmark.x))
      points.append(Double(landmark.y))
    }
    let latencyMs = capturedAt.map { (CACurrentMediaTime() - $0) * 1000 } ?? -1
    DispatchQueue.main.async {
      guard self.active, self.window != nil else {
        return
      }
      self.setStatus("tracking", message: nil)
      self.onLandmarks([
        "points": points,
        "width": Double(size.width),
        "height": Double(size.height),
        "latencyMs": latencyMs,
      ])
    }
  }

  // MARK: Status

  private func emitStatus(_ status: String, message: String? = nil) {
    DispatchQueue.main.async {
      self.setStatus(status, message: message)
    }
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

  var errorDescription: String? {
    switch self {
    case .modelMissing:
      return "顔追跡のモデルが見つかりません"
    }
  }
}
