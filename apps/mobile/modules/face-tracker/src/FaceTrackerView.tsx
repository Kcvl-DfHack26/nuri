import { requireNativeView } from 'expo';

import type { FaceTrackerViewProps } from './FaceTracker.types';

const NativeView = requireNativeView<FaceTrackerViewProps>('FaceTracker');

export default function FaceTrackerView(props: FaceTrackerViewProps) {
  return <NativeView {...props} />;
}
