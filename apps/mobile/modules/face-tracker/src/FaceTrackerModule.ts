import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class FaceTrackerModule extends NativeModule {
  /** Asks for the camera when needed; resolves true when it may be used. */
  requestCameraPermissionAsync(): Promise<boolean>;
}

/** Null where the native module is not built in, such as Expo Go. */
export default requireOptionalNativeModule<FaceTrackerModule>('FaceTracker');
