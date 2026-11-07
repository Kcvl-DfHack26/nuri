# The podspec sits at the module root so iOS and Android share one copy of the model in assets/.
Pod::Spec.new do |s|
  s.name           = 'FaceTracker'
  s.version        = '0.1.0'
  s.summary        = 'Front camera face landmarks with MediaPipe Face Landmarker'
  s.description    = 'Runs MediaPipe Face Landmarker on the front camera on device and sends the landmarks to JavaScript.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '1.0.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.resource_bundles = { 'FaceTrackerModel' => ['assets/face_landmarker.task'] }
end
