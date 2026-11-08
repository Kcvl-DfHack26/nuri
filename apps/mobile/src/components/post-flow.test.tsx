import type { PostAnalysis } from '@starter/shared';
import type { AlertButton } from 'react-native';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { createTestQueryClient } from '@/lib/test/query-client';

import type { PostDraft } from './post-draft';

import { PostCreating } from './post-creating';
import { PostDone } from './post-done';
import { PostDraftProvider, usePostDraft } from './post-draft';
import { PostMessage } from './post-message';
import { PostPreview } from './post-preview';
import { PostReview } from './post-review';
import { PostStepEdit } from './post-step';

const mockDraftKey = '3f2b8c1e-6d4a-4b7e-9c2d-1a5e8f0b7c3d';
jest.mock('expo-crypto', () => ({ randomUUID: () => mockDraftKey }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn((_uri: string, { time }: { time: number }) =>
    Promise.resolve({ uri: `file:///frame-${time}.jpg`, width: 1, height: 1 }),
  ),
}));
const mockDelete = jest.fn();
const mockFileSize = jest.fn((_uri: string) => 1000);
jest.mock('expo-file-system', () => ({
  File: jest.fn((uri: string) => ({
    exists: true,
    delete: mockDelete,
    size: mockFileSize(uri),
    base64: () => Promise.resolve(`/9j/${uri}`),
  })),
}));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => true,
  },
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
    // Pressing the stand-in picks リップ.
    Picker: ({ onValueChange }: { onValueChange: (value: string) => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="部位"
        onPress={() => {
          onValueChange('lip');
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
type PostResponse = { status: number; json?: () => Promise<{ id: string }> };
const mockPost = jest.fn((_request: unknown): Promise<PostResponse> =>
  Promise.resolve({ status: 201, json: () => Promise.resolve({ id: 'p-new' }) }),
);
// ⑫-3 asks to send the video only when an API is configured; most tests run without one.
const mockApi = { url: null as string | null };
const mockAnalyze = jest.fn<
  Promise<PostAnalysis>,
  [{ uri: string; marks: readonly number[] }, AbortSignal]
>();
const mockShrink = jest.fn<Promise<string>, [string, AbortSignal, (progress: number) => void]>(
  (uri) => Promise.resolve(uri),
);
jest.mock('@/lib/post-analysis', () => ({
  analyzePostVideo: (...args: Parameters<typeof mockAnalyze>) => mockAnalyze(...args),
  shrinkVideo: (...args: Parameters<typeof mockShrink>) => mockShrink(...args),
}));
jest.mock('@/lib/api', () => ({
  get apiUrl() {
    return mockApi.url;
  },
  apiAssetUrl: (path: string) => path,
  api: { api: { recipes: { $post: (request: unknown) => mockPost(request) } } },
  authClient: {
    useSession: () => ({ data: { user: { id: 'me', name: 'はなこ', image: null } } }),
  },
}));
const alert = jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.url = null;
  mockShrink.mockImplementation((uri) => Promise.resolve(uri));
  mockFileSize.mockImplementation(() => 1000);
  jest
    .mocked(getThumbnailAsync)
    .mockImplementation((_uri, options) =>
      Promise.resolve({ uri: `file:///frame-${options?.time ?? 0}.jpg`, width: 1, height: 1 }),
    );
});

function renderInDraft(screenElement: React.ReactElement) {
  return render(<PostDraftProvider>{screenElement}</PostDraftProvider>);
}

const brow: PostDraft['steps'][number] = {
  part: 'brow',
  title: '',
  description: '眉尻を足す',
  cosmetics: [],
  segment: { startMs: 0, endMs: 65_000 },
  image: 'file:///step-0.jpg',
};
const readyDraft: Partial<PostDraft> = {
  video: { uri: 'file:///video.mov', marks: [65_000], durationMs: 125_000 },
  steps: [
    brow,
    {
      ...brow,
      part: 'cheek',
      title: '頬に高めに',
      description: '',
      cosmetics: [
        {
          id: 'c',
          name: 'ふんわりチーク',
          category: 'チーク',
          shade: '01',
          color: '#E0A0A0',
        },
      ],
      segment: { startMs: 65_000, endMs: 125_000 },
      image: null,
    },
  ],
  title: ' 狐メイク ',
  message: '高めのチーク',
  tags: ['#時短'],
  thumbnail: { uri: 'file:///thumb.jpg', timeMs: 6000 },
};

/** Puts the screen in a draft that already holds `change`, as earlier ⑫ screens would leave it. */
function Seed({ change, children }: { change: Partial<PostDraft>; children: React.ReactNode }) {
  const { setDraft } = usePostDraft();
  useEffect(() => {
    setDraft((current) => ({ ...current, ...change }));
  }, [change, setDraft]);
  return children;
}

async function renderSeeded(
  screenElement: React.ReactElement,
  change: Partial<PostDraft> = readyDraft,
) {
  const client = createTestQueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const view = await render(
    <QueryClientProvider client={client}>
      <PostDraftProvider>
        <Seed change={change}>{screenElement}</Seed>
      </PostDraftProvider>
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

/** Presses a button of the last native alert. */
async function pressAlertButton(text: string) {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await act(async () => {
    buttons.find((button) => button.text === text)?.onPress?.();
    await Promise.resolve();
  });
}

test('needs a title before previewing', async () => {
  await renderInDraft(<PostMessage />);
  const preview = screen.getByRole('button', { name: 'プレビューを見る' });
  expect(preview).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('タイトル'), '  ');
  expect(preview).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('タイトル'), '狐メイク');
  expect(screen.getByText('4/40')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'プレビューを見る' })).toBeEnabled();
});

test('edits the message and publish options in the draft before previewing', async () => {
  await renderInDraft(<PostMessage />);
  await fireEvent.changeText(screen.getByLabelText('タイトル'), '狐メイク');
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

test('makes one step per marked segment with the frame at its start', async () => {
  await renderSeeded(<PostCreating />, {
    video: { uri: 'file:///video.mov', marks: [4000, 1500], durationMs: 9000 },
  });
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  expect(jest.mocked(getThumbnailAsync).mock.calls.map(([, options]) => options?.time)).toEqual([
    0, 1500, 4000,
  ]);
});

/** Keeps the latest draft so a test can read what ⑫-3 put in it. */
function DraftProbe({ onDraft }: { onDraft: (draft: PostDraft) => void }) {
  const { draft } = usePostDraft();
  useEffect(() => {
    onDraft(draft);
  }, [draft, onDraft]);
  return null;
}

const analysis: PostAnalysis = {
  title: 'ナチュラルメイク',
  summary: '',
  steps: [
    {
      start: 26,
      end: 62,
      part: 'lash',
      description: '目尻にラインを引く',
      regions: [],
      cosmetics: [1],
    },
    { start: 0, end: 26, part: 'brow', description: '眉尻を描き足す', regions: [], cosmetics: [0] },
  ],
  cosmetics: [
    {
      brand: 'peripera',
      name: 'スピーディー スキニー ブロウ',
      category: 'アイブロウ',
      confidence: 'high',
      verified: true,
      sources: [],
    },
    {
      brand: '',
      name: 'アイライナー',
      category: 'アイライナー',
      confidence: 'low',
      verified: null,
      sources: [],
    },
  ],
};

async function renderCreating() {
  mockApi.url = 'https://api.example.com';
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostCreating />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
    { video: { uri: 'file:///video.mov', marks: [26_000], durationMs: 60_000 } },
  );
  return () => latest;
}

test('asks before sending the video and fills the steps with what Gemini found', async () => {
  mockAnalyze.mockResolvedValue(analysis);
  const draft = await renderCreating();
  expect(alert.mock.calls.at(-1)?.[0]).toBe('動画を送って手順書を作りますか');
  expect(mockAnalyze).not.toHaveBeenCalled();
  await pressAlertButton('送る');
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  expect(mockAnalyze.mock.calls[0]?.[0]).toMatchObject({
    uri: 'file:///video.mov',
    marks: [26_000],
  });
  const steps = draft()?.steps ?? [];
  expect(steps.map((step) => [step.part, step.segment, step.description])).toEqual([
    ['brow', { startMs: 0, endMs: 26_000 }, '眉尻を描き足す'],
    // The step's end is cut to the video's length.
    ['lash', { startMs: 26_000, endMs: 60_000 }, '目尻にラインを引く'],
  ]);
  // The cosmetics Gemini saw start chosen.
  expect(steps[0]?.cosmetics.map((cosmetic) => cosmetic.name)).toEqual([
    'peripera スピーディー スキニー ブロウ',
  ]);
  expect(steps[1]?.cosmetics.map((cosmetic) => cosmetic.name)).toEqual(['アイライナー']);
  expect(draft()?.title).toBe('ナチュラルメイク');
  expect(jest.mocked(getThumbnailAsync).mock.calls.map(([, options]) => options?.time)).toEqual([
    0, 26_000,
  ]);
});

test('shrinks a video over the limit, sends the copy and deletes it with the draft', async () => {
  mockShrink.mockImplementation((_uri, _signal, onProgress) => {
    onProgress(0.5);
    return Promise.resolve('file:///shrunk.mp4');
  });
  mockAnalyze.mockResolvedValue(analysis);
  await renderCreating();
  await pressAlertButton('送る');
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  expect(mockShrink.mock.calls[0]?.[0]).toBe('file:///video.mov');
  expect(mockAnalyze.mock.calls[0]?.[0]).toEqual({ uri: 'file:///shrunk.mp4', marks: [26_000] });
  expect(screen.getByLabelText('動画を縮める、完了')).toBeOnTheScreen();
});

test('returns to ⑫-1 without sending when the user chooses やめる', async () => {
  await renderCreating();
  await pressAlertButton('やめる');
  expect(router.back).toHaveBeenCalled();
  expect(mockAnalyze).not.toHaveBeenCalled();
  expect(getThumbnailAsync).not.toHaveBeenCalled();
});

test('says so and makes the steps from the marks when Gemini finds no makeup', async () => {
  mockAnalyze.mockResolvedValue({
    ...analysis,
    // A step that ends before it starts is dropped like no step at all.
    steps: [{ start: 30, end: 10, part: 'brow', description: '', regions: [], cosmetics: [] }],
  });
  const draft = await renderCreating();
  await pressAlertButton('送る');
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  expect(alert).toHaveBeenCalledWith(
    '動画からメイクの手順を見つけられませんでした',
    '区切りから手順を作ります。',
  );
  expect(draft()?.title).toBe('');
  expect(draft()?.steps.map((step) => step.segment)).toEqual([
    { startMs: 0, endMs: 26_000 },
    { startMs: 26_000, endMs: 60_000 },
  ]);
});

test('makes the steps from the marks when the analysis fails', async () => {
  mockAnalyze.mockRejectedValue(new Error('今は動画から手順書を作れません。'));
  const draft = await renderCreating();
  await pressAlertButton('送る');
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  expect(alert).toHaveBeenCalledWith(
    '動画から手順書を作れませんでした',
    '今は動画から手順書を作れません。区切りから手順を作ります。',
  );
  expect(draft()?.steps.map((step) => step.segment)).toEqual([
    { startMs: 0, endMs: 26_000 },
    { startMs: 26_000, endMs: 60_000 },
  ]);
  expect(draft()?.steps.every((step) => step.description === '')).toBe(true);
});

test('lists the steps made from the video with their segment lengths', async () => {
  await renderSeeded(<PostReview />);
  expect(screen.getByText('動画から2つの手順を作りました')).toBeOnTheScreen();
  // An untitled step shows its part's name.
  expect(screen.getByRole('button', { name: '手順1 眉、眉尻を足す、区間 1:05' })).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '手順2 頬に高めに、ふんわりチーク、区間 1:00' }),
  );
  expect(router.push).toHaveBeenCalledWith('/post/step/1');
});

test('picks the part of a step on ⑫-5', async () => {
  await renderSeeded(<PostStepEdit index="0" />);
  expect(screen.getByText('0:00 〜 1:05')).toBeOnTheScreen();
  expect(screen.getByLabelText('タイトル')).toHaveProp('placeholder', '眉');
  await fireEvent.press(screen.getByRole('button', { name: '部位' }));
  expect(screen.getByLabelText('タイトル')).toHaveProp('placeholder', 'リップ');
});

test('asks before posting and sends the steps and thumbnail, never the video', async () => {
  const { invalidate } = await renderSeeded(<PostPreview />);
  expect(screen.getByText('狐メイク')).toBeOnTheScreen();
  expect(screen.getByText('プレビュー')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(alert).toHaveBeenCalledWith(
    '投稿して公開しますか',
    expect.stringContaining('サムネイルの写真と手順をサーバーに送り'),
    expect.any(Array),
  );
  await pressAlertButton('キャンセル');
  expect(mockPost).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith('/post/done');
  });
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith({
    json: {
      key: mockDraftKey,
      title: ' 狐メイク ',
      summary: '高めのチーク',
      tags: ['時短'],
      durationMinutes: 3,
      steps: [
        {
          part: 'brow',
          label: '眉',
          title: '眉',
          description: '眉尻を足す',
          uses: '眉',
          color: '#79513A',
        },
        {
          part: 'cheek',
          label: 'チーク',
          title: '頬に高めに',
          description: '',
          uses: 'ふんわりチーク',
          color: '#E0A0A0',
        },
      ],
      thumbnail: '/9j/file:///thumb.jpg',
    },
  });
  expect(JSON.stringify(mockPost.mock.calls)).not.toContain('video.mov');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipes'] });

  // Coming back to ⑫-8 after posting does not post again.
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(mockPost).toHaveBeenCalledTimes(1);
});

test('keeps the draft when posting fails and posts it on retry', async () => {
  let fail: (() => void) | undefined;
  mockPost.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        fail = () => {
          resolve({ status: 500 });
        };
      }),
  );
  await renderSeeded(<PostPreview />);
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  // A second press while sending is ignored.
  const sending = await screen.findByRole('button', { name: '投稿しています' });
  expect(sending).toBeDisabled();
  await act(async () => {
    fail?.();
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(alert).toHaveBeenLastCalledWith(
      '投稿できませんでした',
      '投稿できませんでした。時間をおいてお試しください。',
    );
  });
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByText('狐メイク')).toBeOnTheScreen();

  // The button comes back once the failed mutation settles.
  await fireEvent.press(await screen.findByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith('/post/done');
  });
  expect(mockPost).toHaveBeenCalledTimes(2);
});

test('cuts a smaller thumbnail when the chosen frame is over the limit', async () => {
  mockFileSize.mockImplementation((uri) => (uri === 'file:///thumb.jpg' ? 2_000_000 : 1000));
  await renderSeeded(<PostPreview />);
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalled();
  });
  expect(getThumbnailAsync).toHaveBeenCalledWith('file:///video.mov', {
    time: 6000,
    quality: 0.3,
  });
  expect(mockPost.mock.calls[0]?.[0]).toMatchObject({
    json: { thumbnail: '/9j/file:///frame-6000.jpg' },
  });
});

test('does not ask to post without a title', async () => {
  await renderSeeded(<PostPreview />, { ...readyDraft, title: ' ' });
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(alert).toHaveBeenCalledWith('投稿できません', 'タイトルを確認してください。');
  expect(mockPost).not.toHaveBeenCalled();
});

test('opens the posted recipe or goes home', async () => {
  await renderSeeded(<PostDone />, { ...readyDraft, postedId: 'p-new' });
  expect(screen.getByText('投稿しました！')).toBeOnTheScreen();
  expect(screen.getByLabelText('動画 2:05')).toBeOnTheScreen();
  expect(screen.getByLabelText('手順 2')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '投稿を見る' }));
  expect(router.replace).toHaveBeenCalledWith('/recipes/p-new');
  expect(screen.getByRole('button', { name: '友だちに共有（準備中）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: 'ホームに戻る' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});
