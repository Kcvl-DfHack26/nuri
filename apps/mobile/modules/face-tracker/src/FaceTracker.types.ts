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
/** A frame saved on the device with the landmarks found in it. */
export type FaceSnapshot = FacePhotoLandmarks & {
  /** The JPEG's file URI, mirrored like the preview. */
  uri: string;
};

export type FaceTrackerViewRef = {
  /**
   * Saves the last frame with a face as a JPEG in the app's cache and returns it with that frame's
   * landmarks (upright and unmirrored, like onLandmarks); null when no face was found yet. The
   * caller deletes the file when it no longer shows it.
   */
  takeSnapshotAsync(): Promise<FaceSnapshot | null>;
};

export type FaceTrackerViewProps = {
  ref?: Ref<FaceTrackerViewRef> | undefined;
  /** Runs the camera and face tracking while true. */
  active: boolean;
  onLandmarks?: (event: { nativeEvent: FaceLandmarksEvent }) => void;
  onStatus?: (event: { nativeEvent: FaceTrackerStatusEvent }) => void;
  style?: StyleProp<ViewStyle>;
};
