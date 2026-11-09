import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Linking, Text } from 'react-native';

import { PostCamera, PostRecording } from './post-camera';
import { PostDraftProvider, usePostDraft } from './post-draft';

type Recording = { resolve: (result: { uri: string }) => void };
const mockRecording: { current: Recording | null; ready: (() => void) | null } = {
  current: null,
  ready: null,
};
const mockStopRecording = jest.fn();

jest.mock('expo-camera', () => {
  const { useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  return {
    useCameraPermissions: jest.fn(),
    useMicrophonePermissions: jest.fn(),
    // Records until stopRecording, like the native view, and lets the test fire onCameraReady.
    CameraView: ({
      ref,
      onCameraReady,
    }: {
      ref?: React.Ref<unknown>;
      onCameraReady?: () => void;
    }) => {
      mockRecording.ready = onCameraReady ?? null;
      useImperativeHandle(ref, () => ({
        recordAsync: () =>
          new Promise((resolve) => {
            mockRecording.current = { resolve };
          }),
        stopRecording: mockStopRecording,
      }));
      return null;
    },
  };
});
const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, delete: mockDelete })),
}));

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerControllerQualityType: { Medium: 1 },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useIsFocused: () => true,
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/lib/api', () => ({
  authClient: { useSession: () => ({ data: mockSignedIn ? { user: { id: 'viewer' } } : null }) },
}));
let mockSignedIn = true;

const pick = jest.mocked(launchImageLibraryAsync);
const alert = jest.spyOn(Alert, 'alert');
const cameraPermission = jest.mocked(useCameraPermissions);
const microphonePermission = jest.mocked(useMicrophonePermissions);
const requestCamera = jest.fn();
const requestMicrophone = jest.fn();

function permission(granted: boolean, canAskAgain = true) {
  return {
    granted,
    canAskAgain,
    status: granted ? 'granted' : 'denied',
    expires: 'never',
  } as never;
}

function allow(camera: boolean, microphone: boolean, canAskAgain = true) {
  cameraPermission.mockReturnValue([permission(camera, canAskAgain), requestCamera, jest.fn()]);
  microphonePermission.mockReturnValue([
    permission(microphone, canAskAgain),
    requestMicrophone,
    jest.fn(),
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecording.current = null;
  mockRecording.ready = null;
  allow(true, true);
});

test('opens ⑫-2 without asking when recording starts', async () => {
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  expect(alert).not.toHaveBeenCalled();
  // ⑫-1 closes its camera first, then opens ⑫-2.
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith('/post/recording');
  });
});

test('opens ⑫-3 with the chosen video without asking', async () => {
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///video.mov', width: 1080, height: 1920 }],
  });
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/post/creating',
      params: { video: 'file:///video.mov' },
    });
  });
  expect(pick).toHaveBeenCalledWith({ mediaTypes: 'videos', videoQuality: 1 });
  expect(alert).not.toHaveBeenCalled();
});

test('stays on ⑫-1 when the picker is canceled', async () => {
  pick.mockResolvedValue({ canceled: true, assets: null });
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  await waitFor(() => {
    expect(pick).toHaveBeenCalled();
  });
  expect(router.push).not.toHaveBeenCalled();
});

function DraftVideo() {
  const { draft } = usePostDraft();
  return (
    <Text>{draft.video ? [draft.video.uri, ...draft.video.marks].join(' ') : '動画なし'}</Text>
  );
}

test('sends a guest to log in before recording or choosing a video', async () => {
  mockSignedIn = false;
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  expect(router.push).toHaveBeenCalledTimes(2);
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(pick).not.toHaveBeenCalled();
  mockSignedIn = true;
});

test('keeps the chosen video in the post being prepared', async () => {
  const { unmount } = await render(
    <PostDraftProvider videoUri="file:///video.mov">
      <DraftVideo />
    </PostDraftProvider>,
  );
  expect(screen.getByText('file:///video.mov')).toBeOnTheScreen();
  // The chosen video is not the draft's own file, so leaving the flow keeps it.
  await unmount();
  expect(File).not.toHaveBeenCalled();
});

test('starts without a video when the post is recorded', async () => {
  await render(
    <PostDraftProvider>
      <DraftVideo />
    </PostDraftProvider>,
  );
  expect(screen.getByText('動画なし')).toBeOnTheScreen();
});

test('asks for the camera and the microphone together when ⑫-1 opens', async () => {
  allow(false, false);
  await render(<PostCamera />);
  await waitFor(() => {
    expect(requestMicrophone).toHaveBeenCalled();
  });
  expect(requestCamera).toHaveBeenCalledTimes(1);
  expect(screen.getByText('動画を撮るには、カメラとマイクの許可が必要です')).toBeOnTheScreen();
});

test('asks nothing when both are already allowed', async () => {
  await render(<PostCamera />);
  expect(requestCamera).not.toHaveBeenCalled();
  expect(requestMicrophone).not.toHaveBeenCalled();
  expect(screen.queryByText('動画を撮るには、カメラとマイクの許可が必要です')).toBeNull();
});

test('opens the Settings app once the OS will not ask again', async () => {
  allow(true, false, false);
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '設定を開く' }));
  expect(openSettings).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  expect(alert).not.toHaveBeenCalled();
  expect(openSettings).toHaveBeenCalledTimes(2);
});

function renderRecording() {
  return render(
    <PostDraftProvider>
      <PostRecording />
      <DraftVideo />
    </PostDraftProvider>,
  );
}

test('records without 手順を区切る and opens ⑫-3 with no marks', async () => {
  jest.useFakeTimers({ now: 0 });
  await renderRecording();
  await act(() => {
    mockRecording.ready?.();
  });
  await act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByLabelText('録画時間 0分2秒')).toBeOnTheScreen();
  // Gemini finds the steps, so the recording is not split while it runs (#186).
  expect(screen.queryByRole('button', { name: /手順を区切る/ })).toBeNull();
  expect(screen.queryByText(/を撮影中/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '撮影を終える' }));
  expect(mockStopRecording).toHaveBeenCalled();
  await act(async () => {
    mockRecording.current?.resolve({ uri: 'file:///recorded.mov' });
    await Promise.resolve();
  });
  expect(screen.getByText('file:///recorded.mov')).toBeOnTheScreen();
  expect(router.replace).toHaveBeenCalledWith('/post/creating');
  jest.useRealTimers();
});

test('deletes the video when the recording is closed', async () => {
  await renderRecording();
  await act(() => {
    mockRecording.ready?.();
  });
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(mockStopRecording).toHaveBeenCalled();
  await act(async () => {
    mockRecording.current?.resolve({ uri: 'file:///recorded.mov' });
    await Promise.resolve();
  });
  expect(File).toHaveBeenCalledWith('file:///recorded.mov');
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByText('動画なし')).toBeOnTheScreen();
});

test('deletes the video and leaves ⑫-2 when the OS stops the recording', async () => {
  await renderRecording();
  await act(() => {
    mockRecording.ready?.();
  });
  await act(async () => {
    mockRecording.current?.resolve({ uri: 'file:///interrupted.mov' });
    await Promise.resolve();
  });
  expect(File).toHaveBeenCalledWith('file:///interrupted.mov');
  expect(alert).toHaveBeenCalledWith('録画が中断されました', 'もう一度お試しください。');
  expect(router.back).toHaveBeenCalled();
  expect(screen.getByText('動画なし')).toBeOnTheScreen();
});

test('deletes the finished recording when the post flow closes', async () => {
  const { unmount } = await renderRecording();
  await act(() => {
    mockRecording.ready?.();
  });
  await fireEvent.press(screen.getByRole('button', { name: '撮影を終える' }));
  await act(async () => {
    mockRecording.current?.resolve({ uri: 'file:///recorded.mov' });
    await Promise.resolve();
  });
  expect(File).not.toHaveBeenCalled();
  await unmount();
  expect(File).toHaveBeenCalledWith('file:///recorded.mov');
  expect(mockDelete).toHaveBeenCalledTimes(1);
});
