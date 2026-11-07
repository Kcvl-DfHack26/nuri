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

export type FaceTrackerStatus = 'tracking' | 'noFace' | 'permissionDenied' | 'error';

export type FaceTrackerStatusEvent = {
  status: FaceTrackerStatus;
  message?: string;
};

export type FaceTrackerViewProps = {
  /** Runs the camera and face tracking while true. */
  active: boolean;
  onLandmarks?: (event: { nativeEvent: FaceLandmarksEvent }) => void;
  onStatus?: (event: { nativeEvent: FaceTrackerStatusEvent }) => void;
  style?: StyleProp<ViewStyle>;
};
