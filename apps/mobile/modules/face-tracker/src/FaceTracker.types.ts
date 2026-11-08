import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** Landmarks of one face, normalized to the upright, unmirrored camera frame. */
export type FaceLandmarksEvent = {
  /** Flat x, y pairs in 0–1 for MediaPipe's 478 landmarks. */
  points: number[];
  /** Size of the upright frame in pixels. */
  width: number;
  height: number;
  /** Time from receiving the frame to its result on device, in milliseconds. */
  latencyMs: number;
};

/** Landmarks of one face in a still photo, normalized to the upright photo. */
export type FacePhotoLandmarks = {
  /** Flat x, y pairs in 0–1 for MediaPipe's 478 landmarks. */
  points: number[];
  /** Size of the upright photo in pixels. */
  width: number;
  height: number;
};

export type FaceTrackerStatus = 'tracking' | 'noFace' | 'permissionDenied' | 'error';

export type FaceTrackerStatusEvent = {
  status: FaceTrackerStatus;
  message?: string;
};

/** Methods of a mounted FaceTrackerView. */
export type FaceTrackerViewRef = {
  /**
   * Saves the current frame as a JPEG in the app's cache, mirrored like the preview. Returns null
   * before the camera supplies a frame. The caller deletes the file when it no longer shows it.
   */
  takeSnapshotAsync(): Promise<string | null>;
};

export type FaceTrackerViewProps = {
  ref?: Ref<FaceTrackerViewRef> | undefined;
  /** Runs the camera while true. Live tracking is enabled by default. */
  active: boolean;
  /** Skip live landmarks when the screen only needs a still camera frame. */
  trackLandmarks?: boolean;
  onLandmarks?: (event: { nativeEvent: FaceLandmarksEvent }) => void;
  onStatus?: (event: { nativeEvent: FaceTrackerStatusEvent }) => void;
  style?: StyleProp<ViewStyle>;
};
