import type { AlertButton } from 'react-native';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Text } from 'react-native';

import { PostCamera } from './post-camera';
import { PostDraftProvider, usePostDraft } from './post-draft';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useIsFocused: () => true,
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

const pick = jest.mocked(launchImageLibraryAsync);
const alert = jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

/** Presses the consent dialog's button with the given label. */
function answer(label: 'はい' | 'いいえ') {
  expect(alert).toHaveBeenCalledWith(
    '動画をサーバーへ送信して解析します',
    undefined,
    expect.any(Array),
  );
  const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
  buttons.find((button) => button.text === label)?.onPress?.();
}

test('asks before recording and records only after consent', async () => {
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  answer('はい');
  expect(router.push).toHaveBeenCalledWith('/post/recording');
});

test('stays on ⑫-1 when recording is declined', async () => {
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  answer('いいえ');
  expect(router.push).not.toHaveBeenCalled();
});

test('opens ⑫-3 with the chosen video after consent', async () => {
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///video.mov', width: 1080, height: 1920 }],
  });
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  await waitFor(() => {
    expect(alert).toHaveBeenCalled();
  });
  expect(pick).toHaveBeenCalledWith({ mediaTypes: 'videos' });
  answer('はい');
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/post/creating',
    params: { video: 'file:///video.mov' },
  });
});

test('sends nothing when the chosen video is declined', async () => {
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///video.mov', width: 1080, height: 1920 }],
  });
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  await waitFor(() => {
    expect(alert).toHaveBeenCalled();
  });
  answer('いいえ');
  expect(router.push).not.toHaveBeenCalled();
});

test('asks nothing when the picker is canceled', async () => {
  pick.mockResolvedValue({ canceled: true, assets: null });
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '動画から' }));
  await waitFor(() => {
    expect(pick).toHaveBeenCalled();
  });
  expect(alert).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

function DraftVideo() {
  const { draft } = usePostDraft();
  return <Text>{draft.video?.uri ?? '動画なし'}</Text>;
}

test('keeps the chosen video in the post being prepared', async () => {
  await render(
    <PostDraftProvider videoUri="file:///video.mov">
      <DraftVideo />
    </PostDraftProvider>,
  );
  expect(screen.getByText('file:///video.mov')).toBeOnTheScreen();
});

test('starts without a video when the post is recorded', async () => {
  await render(
    <PostDraftProvider>
      <DraftVideo />
    </PostDraftProvider>,
  );
  expect(screen.getByText('動画なし')).toBeOnTheScreen();
});
