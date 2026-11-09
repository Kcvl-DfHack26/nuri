import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { MakeupLayer } from '@/lib/face-makeup';

import type {
  FaceLandmarksEvent,
  FaceTrackerStatusEvent,
  FaceTrackerViewProps,
} from '../../modules/face-tracker/src/FaceTracker.types';

import browTexture from '../../assets/textures/brow.png';
import lipTexture from '../../assets/textures/lip.png';
import { FaceMakeupCamera } from './face-makeup-camera';

const mockTrackerProps = jest.fn<undefined, [FaceTrackerViewProps]>();
const mockUseImage = jest.fn((_source: unknown) => ({ width: () => 1024, height: () => 1024 }));
const mockMakeShapeTexture = jest.fn();

jest.mock('../../modules/face-tracker/src/FaceTrackerModule', () => ({
  __esModule: true,
  default: { requestCameraPermissionAsync: () => Promise.resolve(true) },
}));
jest.mock('../../modules/face-tracker/src/FaceTrackerView', () => ({
  __esModule: true,
  default: (props: FaceTrackerViewProps) => {
    mockTrackerProps(props);
    return null;
  },
}));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: { children: ReactNode }) => children,
  useImage: (source: unknown) => mockUseImage(source),
}));
jest.mock('@/components/face-texture', () => ({
  FaceTexture: () => {
    const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
    return <reactNative.View testID="face-texture" />;
  },
}));
jest.mock('@/components/shape-texture', () => ({
  // Counts how often a shape's texture is made, like the real hook's memo.
  useShapeTexture: (shape: unknown) =>
    jest.requireActual<typeof import('react')>('react').useMemo(() => {
      if (!shape) {
        return null;
      }
      mockMakeShapeTexture();
      return { width: () => 512, height: () => 512 };
    }, [shape]),
}));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

const brow: MakeupLayer = { part: 'brow', color: '#79513A' };
// A brow line through landmarks 70, 63 and 105, valid under makeupShapeSchema.
const browStroke = { strokes: [{ points: [{ at: 70 }, { at: 63 }, { at: 105 }], width: 0.02 }] };
const viewSize = { width: 360, height: 640 };
// MediaPipe's 478 landmarks, all at the middle of the frame.
const landmarks: FaceLandmarksEvent = {
  points: Array.from({ length: 478 * 2 }, () => 0.5),
  width: 720,
  height: 1280,
  latencyMs: 30,
};

function latestTrackerProps() {
  const props = mockTrackerProps.mock.lastCall?.[0];
  if (!props) {
    throw new Error('FaceTrackerView was not rendered');
  }
  return props;
}

async function sendStatus(status: FaceTrackerStatusEvent) {
  await act(() => {
    latestTrackerProps().onStatus?.({ nativeEvent: status });
  });
}

async function sendLandmarks() {
  await act(() => {
    latestTrackerProps().onLandmarks?.({ nativeEvent: landmarks });
  });
}

// The camera starts once the permission request resolves and it knows its size.
async function renderCamera(props: Parameters<typeof FaceMakeupCamera>[0]) {
  const view = await render(<FaceMakeupCamera {...props} />);
  const root = screen.root;
  if (!root) {
    throw new Error('FaceMakeupCamera rendered nothing');
  }
  await fireEvent(root, 'layout', {
    nativeEvent: { layout: viewSize },
  });
  return view;
}

test('tracks the face only while there is something to place on it', async () => {
  const view = await renderCamera({ layers: [] });
  expect(latestTrackerProps()).toMatchObject({ active: true, trackLandmarks: false });

  await view.rerender(
    <FaceMakeupCamera layers={[brow]} annotation={{ part: 'brow', label: '眉' }} />,
  );
  expect(latestTrackerProps().trackLandmarks).toBe(true);

  await view.rerender(<FaceMakeupCamera layers={[]} annotation={{ part: 'brow', label: '眉' }} />);
  expect(latestTrackerProps().trackLandmarks).toBe(true);
});

test('does not ask for the face while tracking is stopped', async () => {
  const view = await renderCamera({ layers: [brow] });
  await sendStatus({ status: 'noFace' });
  expect(screen.getByText('顔をカメラに向けてください')).toBeOnTheScreen();

  await view.rerender(<FaceMakeupCamera layers={[]} />);
  expect(screen.queryByText('顔をカメラに向けてください')).toBeNull();

  // Native reports only changes, so the face is still missing when tracking resumes.
  await view.rerender(<FaceMakeupCamera layers={[brow]} />);
  expect(screen.getByText('顔をカメラに向けてください')).toBeOnTheScreen();
});

test('keeps the camera permission guidance while tracking is stopped', async () => {
  await renderCamera({ layers: [] });
  await sendStatus({ status: 'permissionDenied' });

  expect(screen.getByText('カメラを使う許可がありません')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '設定を開く' })).toBeOnTheScreen();
});

test('drops landmarks that arrive after tracking stops', async () => {
  const view = await renderCamera({ layers: [brow] });
  await sendLandmarks();
  expect(screen.getByTestId('face-texture')).toBeOnTheScreen();

  await view.rerender(<FaceMakeupCamera layers={[]} />);
  await sendLandmarks();
  await view.rerender(<FaceMakeupCamera layers={[brow]} />);

  expect(screen.queryByTestId('face-texture')).toBeNull();
});

test('loads only the standard textures of the painted parts', async () => {
  const shaped: MakeupLayer = {
    part: 'cheek',
    color: '#B8754F',
    shape: browStroke,
  };
  await renderCamera({ layers: [brow, { part: 'lip', color: '#C0392B' }, shaped] });

  const sources = new Set(mockUseImage.mock.calls.map(([source]) => source));
  expect(sources).toEqual(new Set([browTexture, lipTexture, null]));
});

test('keeps the step shape texture when the face is lost and found again', async () => {
  const shaped: MakeupLayer = {
    part: 'brow',
    color: '#79513A',
    shape: browStroke,
  };
  await renderCamera({ layers: [shaped] });
  await sendLandmarks();
  expect(screen.getByTestId('face-texture')).toBeOnTheScreen();

  await sendStatus({ status: 'noFace' });
  expect(screen.queryByTestId('face-texture')).toBeNull();
  await sendLandmarks();

  expect(screen.getByTestId('face-texture')).toBeOnTheScreen();
  expect(mockMakeShapeTexture).toHaveBeenCalledTimes(1);
});
