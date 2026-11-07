import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { FacePhotoLandmarks } from './FaceTracker.types';

declare class FaceTrackerModule extends NativeModule {
  /** Asks for the camera when needed; resolves true when it may be used. */
  requestCameraPermissionAsync(): Promise<boolean>;
  /** Finds one face in a local photo on device; null when there is no face. */
  detectFaceAsync(uri: string): Promise<FacePhotoLandmarks | null>;
}

/** Null where the native module is not built in, such as Expo Go. */
export default requireOptionalNativeModule<FaceTrackerModule>('FaceTracker');
