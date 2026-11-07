import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { PostDone } from './post-done';
import { PostDraftProvider } from './post-draft';
import { PostMessage } from './post-message';
import { PostPreview } from './post-preview';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn((_uri: string, { time }: { time: number }) =>
    Promise.resolve({ uri: `file:///frame-${time}.jpg`, width: 1, height: 1 }),
  ),
}));
const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, delete: mockDelete })),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@expo/ui', () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Icon: Object.assign(() => null, { select: () => 'icon' }),
    Host: View,
    // Pressing the stand-in moves the slider to 2 seconds.
    Slider: ({ onValueChange }: { onValueChange: (value: number) => void }) => (
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="サムネイルの時点"
        onPress={() => {
          onValueChange(2000);
        }}
      />
    ),
  };
});
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
// The preview must not need the API: the post exists only on the device.
jest.mock('@/lib/api', () => ({ apiUrl: null, apiAssetUrl: (path: string) => path, api: {} }));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getThumbnailAsync)
    .mockImplementation((_uri, options) =>
      Promise.resolve({ uri: `file:///frame-${options?.time ?? 0}.jpg`, width: 1, height: 1 }),
    );
});

function renderInDraft(screenElement: React.ReactElement) {
  return render(<PostDraftProvider>{screenElement}</PostDraftProvider>);
}

test('edits the message and publish options in the draft before previewing', async () => {
  await renderInDraft(<PostMessage />);
  const message = screen.getByLabelText('メッセージ');
  await fireEvent.changeText(message, 'チークを高めに');
  expect(screen.getByText('7/200')).toBeOnTheScreen();

  const cosmetics = screen.getByLabelText('使ったコスメを公開');
  expect(cosmetics).toHaveProp('value', true);
  await fireEvent(cosmetics, 'valueChange', false);
  expect(screen.getByLabelText('使ったコスメを公開')).toHaveProp('value', false);
  // Before and After are not built, so their photos and publish option stay hidden.
  expect(screen.queryByLabelText('Before写真を公開')).toBeNull();
  expect(screen.queryByLabelText('Beforeの見本の写真')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'プレビューを見る' }));
  expect(router.push).toHaveBeenCalledWith('/post/preview');
});

test('starts without tags, adds each tag once and removes it', async () => {
  await renderInDraft(<PostMessage />);
  expect(screen.queryByRole('button', { name: /を削除$/ })).toBeNull();
  const input = screen.getByLabelText('タグ');
  await fireEvent.changeText(input, '時短');
  await fireEvent.press(screen.getByRole('button', { name: 'タグを追加' }));
  expect(screen.getByRole('button', { name: '#時短を削除' })).toBeOnTheScreen();
  expect(input).toHaveProp('value', '');

  await fireEvent.changeText(input, '#時短');
  await fireEvent(input, 'submitEditing');
  expect(screen.getAllByRole('button', { name: '#時短を削除' })).toHaveLength(1);

  await fireEvent.press(screen.getByRole('button', { name: '#時短を削除' }));
  expect(screen.queryByRole('button', { name: '#時短を削除' })).toBeNull();
});

test('shows the sample photo as the thumbnail without a video', async () => {
  await renderInDraft(<PostMessage />);
  expect(screen.getByText('サムネイルの設定')).toBeOnTheScreen();
  expect(screen.getByLabelText('サムネイルの見本の写真')).toBeOnTheScreen();
  expect(getThumbnailAsync).not.toHaveBeenCalled();
});

function renderWithVideo() {
  return render(
    <PostDraftProvider videoUri="file:///video.mov" videoDurationMs={6100}>
      <PostMessage />
    </PostDraftProvider>,
  );
}

test('defaults the thumbnail to the last frame and changes it on the timeline', async () => {
  await renderWithVideo();
  const thumbnail = await screen.findByRole('button', { name: 'サムネイル 0:06の場面' });
  expect(getThumbnailAsync).toHaveBeenCalledWith('file:///video.mov', { time: 6000, quality: 0.7 });
  expect(screen.queryByLabelText('サムネイルの時点')).toBeNull();

  await fireEvent.press(thumbnail);
  await fireEvent.press(screen.getByLabelText('サムネイルの時点'));
  expect(await screen.findByLabelText('サムネイル 0:02の場面')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(screen.queryByLabelText('サムネイルの時点')).toBeNull();
  expect(screen.getByRole('button', { name: 'サムネイル 0:02の場面' })).toBeOnTheScreen();
});

test('keeps 決定 disabled until the frame under the slider is cut', async () => {
  let finish: (() => void) | undefined;
  jest.mocked(getThumbnailAsync).mockImplementation((_uri, options) => {
    const time = options?.time ?? 0;
    const result = { uri: `file:///frame-${time}.jpg`, width: 1, height: 1 };
    if (time !== 2000) {
      return Promise.resolve(result);
    }
    return new Promise((resolve) => {
      finish = () => {
        resolve(result);
      };
    });
  });
  await renderWithVideo();
  await fireEvent.press(await screen.findByRole('button', { name: 'サムネイル 0:06の場面' }));
  await fireEvent.press(screen.getByLabelText('サムネイルの時点'));
  // The 0:06 frame is still shown while 0:02 is cut, so it must not be kept for 0:02.
  expect(screen.getByRole('button', { name: '決定' })).toBeDisabled();
  await act(async () => {
    finish?.();
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: '決定' })).toBeEnabled();
});

test('lets another moment be chosen when the default frame cannot be cut', async () => {
  jest.mocked(getThumbnailAsync).mockImplementation((_uri, options) => {
    const time = options?.time ?? 0;
    return time === 2000
      ? Promise.resolve({ uri: 'file:///frame-2000.jpg', width: 1, height: 1 })
      : Promise.reject(new Error('unreadable'));
  });
  await renderWithVideo();
  expect(
    await screen.findByText('場面を切り出せませんでした。タップして別の場面を選んでください'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'サムネイルの見本の写真' }));
  await fireEvent.press(screen.getByLabelText('サムネイルの時点'));
  await screen.findByLabelText('サムネイル 0:02の場面');
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  expect(screen.getByRole('button', { name: 'サムネイル 0:02の場面' })).toBeOnTheScreen();
});

test('deletes the cut frames when the post flow closes', async () => {
  const { unmount } = await renderWithVideo();
  await screen.findByRole('button', { name: 'サムネイル 0:06の場面' });
  await unmount();
  expect(File).toHaveBeenCalledWith('file:///frame-6000.jpg');
  expect(mockDelete).toHaveBeenCalled();
});

test('deletes a frame that arrives after the post flow closed', async () => {
  let finish: (() => void) | undefined;
  jest.mocked(getThumbnailAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => {
          resolve({ uri: 'file:///late.jpg', width: 1, height: 1 });
        };
      }),
  );
  const { unmount } = await renderWithVideo();
  await unmount();
  await act(async () => {
    finish?.();
    await Promise.resolve();
  });
  expect(File).toHaveBeenCalledWith('file:///late.jpg');
  expect(mockDelete).toHaveBeenCalled();
});

test('keeps the thumbnail when the timeline is canceled', async () => {
  await renderWithVideo();
  await fireEvent.press(await screen.findByRole('button', { name: 'サムネイル 0:06の場面' }));
  await fireEvent.press(screen.getByLabelText('サムネイルの時点'));
  await screen.findByLabelText('サムネイル 0:02の場面');
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByRole('button', { name: 'サムネイル 0:06の場面' })).toBeOnTheScreen();
});

test('returns to the step list from the guide summary', async () => {
  await renderInDraft(<PostMessage />);
  await fireEvent.press(screen.getByRole('button', { name: /^手順書 \d+ステップを確認する$/ }));
  expect(router.back).toHaveBeenCalled();
});

test('opens the sample recipe or goes home after posting', async () => {
  await renderInDraft(<PostDone />);
  expect(screen.getByText('投稿しました！')).toBeOnTheScreen();
  expect(screen.getByLabelText('動画 14:32')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '投稿を見る' }));
  expect(router.replace).toHaveBeenCalledWith('/recipes/fox');
  expect(screen.getByRole('button', { name: '友だちに共有（準備中）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: 'ホームに戻る' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});

test('previews the post without the API and posts it', async () => {
  await renderInDraft(<PostPreview />);
  expect(screen.getByText('狐メイク')).toBeOnTheScreen();
  expect(screen.getByText('プレビュー')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(router.push).toHaveBeenCalledWith('/post/done');
});
