import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FaceTrackingCheck } from './face-tracking-check';

let mockFocused = true;

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: (props: object) => <View testID="overlay-canvas" {...props} />,
    Points: () => null,
    useImage: () => null,
  };
});
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#b53665' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../modules/face-tracker/src/FaceTrackerModule', () => ({
  __esModule: true,
  default: { requestCameraPermissionAsync: () => Promise.resolve(true) },
}));
jest.mock('../../modules/face-tracker/src/FaceTrackerView', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: (props: object) => <View testID="tracker" {...props} /> };
});

beforeEach(() => {
  mockFocused = true;
});

test('clears tracking results on blur and waits for a new result after focus', async () => {
  const result = await render(<FaceTrackingCheck />);
  await waitFor(() => {
    expect(screen.getByTestId('tracker').props.active).toBe(true);
  });
  await fireEvent(screen.getByTestId('tracker'), 'onStatus', {
    nativeEvent: { status: 'tracking' },
  });
  await fireEvent(screen.getByTestId('tracker'), 'onLandmarks', {
    nativeEvent: { points: [], width: 640, height: 480, latencyMs: 12 },
  });
  expect(screen.getByTestId('overlay-canvas')).toBeOnTheScreen();
  expect(screen.getByText(/fps・遅延/)).toBeOnTheScreen();

  mockFocused = false;
  await result.rerender(<FaceTrackingCheck />);
  expect(screen.queryByTestId('overlay-canvas')).toBeNull();
  expect(screen.queryByText(/fps・遅延/)).toBeNull();

  mockFocused = true;
  await result.rerender(<FaceTrackingCheck />);
  expect(screen.queryByTestId('overlay-canvas')).toBeNull();
  expect(screen.queryByText(/fps・遅延/)).toBeNull();
});

test('hides switches during errors and restores them when tracking resumes', async () => {
  await render(<FaceTrackingCheck />);
  await waitFor(() => {
    expect(screen.getByTestId('tracker').props.active).toBe(true);
  });
  await fireEvent(screen.getByTestId('tracker'), 'onStatus', {
    nativeEvent: { status: 'error', message: '前面カメラを使えません' },
  });
  expect(screen.getByText('前面カメラを使えません')).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox', { name: '眉' })).toBeNull();

  await fireEvent(screen.getByTestId('tracker'), 'onStatus', {
    nativeEvent: { status: 'tracking' },
  });
  expect(screen.getByRole('checkbox', { name: '眉' })).toBeOnTheScreen();
});
