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
   * Saves the frame of the landmarks sent last as a JPEG in the app's cache, mirrored like the
   * preview; null when no face was found yet.
   */
  takeSnapshotAsync(): Promise<string | null>;
};

export type FaceTrackerViewProps = {
  ref?: Ref<FaceTrackerViewRef> | undefined;
  /** Runs the camera and face tracking while true. */
  active: boolean;
  onLandmarks?: (event: { nativeEvent: FaceLandmarksEvent }) => void;
  onStatus?: (event: { nativeEvent: FaceTrackerStatusEvent }) => void;
  style?: StyleProp<ViewStyle>;
};
