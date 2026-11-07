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
jest.mock('@/lib/api', () => ({
  authClient: { useSession: () => ({ data: mockSignedIn ? { user: { id: 'viewer' } } : null }) },
}));
let mockSignedIn = true;

const pick = jest.mocked(launchImageLibraryAsync);
const alert = jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

test('opens ⑫-2 without asking when recording starts', async () => {
  await render(<PostCamera />);
  await fireEvent.press(screen.getByRole('button', { name: '録画をはじめる' }));
  expect(alert).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/post/recording');
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
  expect(pick).toHaveBeenCalledWith({ mediaTypes: 'videos' });
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
  return <Text>{draft.video?.uri ?? '動画なし'}</Text>;
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
