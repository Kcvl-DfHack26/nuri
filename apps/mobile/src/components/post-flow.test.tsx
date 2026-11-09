import type { PostAnalysis } from '@starter/shared';
import type { AlertButton } from 'react-native';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { cheekShape, plainCheek } from '@/lib/cheek-shape';
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
// A stand-in video player that records what ⑫-5 asks of it and lets a test send its events.
const mockPlayer = {
  currentTime: 0,
  status: 'readyToPlay',
  playing: false,
  timeUpdateEventInterval: 0,
  play: jest.fn(),
  pause: jest.fn(),
  listeners: new Map<string, (payload: object) => void>(),
  addListener(name: string, listener: (payload: object) => void) {
    this.listeners.set(name, listener);
    return { remove: () => this.listeners.delete(name) };
  },
};
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup?: (player: typeof mockPlayer) => void) => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    // Like expo-video, set the player up once.
    const [player] = useState(() => {
      setup?.(mockPlayer);
      return mockPlayer;
    });
    return player;
  },
  VideoView: () => null,
}));
// The frame's face, as the face tracker would find it: the canonical mesh laid over the photo.
const mockTracker = {
  value: {
    detectFaceAsync: jest.fn((_uri: string) => {
      const { canonicalFaceMesh } =
        jest.requireActual<typeof import('@/lib/face-mesh')>('@/lib/face-mesh');
      return Promise.resolve({
        points: canonicalFaceMesh.textureCoordinates.flatMap((point) => [point.x, point.y]),
        width: 1000,
        height: 1000,
      });
    }),
  } as { detectFaceAsync: (uri: string) => Promise<unknown> } | null,
};
jest.mock('../../modules/face-tracker/src/FaceTrackerModule', () => ({
  __esModule: true,
  get default() {
    return mockTracker.value;
  },
}));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: jest.requireActual<typeof import('react-native')>('react-native').View,
  Circle: () => null,
  LinearGradient: () => null,
  RoundedRect: () => null,
  vec: (x: number, y: number) => ({ x, y }),
}));
jest.mock('@/components/shape-texture', () => ({ useShapeTexture: () => null }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
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
    // Pressing the stand-in moves the slider to `mockSlider.value`.
    Slider: ({
      testID,
      onValueChange,
    }: {
      testID: string;
      onValueChange: (value: number) => void;
    }) => (
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={testID}
        onPress={() => {
          onValueChange(mockSlider.value);
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
const mockSlider = { value: 2000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockSlider.value = 2000;
  mockTracker.value = {
    detectFaceAsync: jest.fn((_uri: string) => {
      const { canonicalFaceMesh } =
        jest.requireActual<typeof import('@/lib/face-mesh')>('@/lib/face-mesh');
      return Promise.resolve({
        points: canonicalFaceMesh.textureCoordinates.flatMap((point) => [point.x, point.y]),
        width: 1000,
        height: 1000,
      });
    }),
  };
  mockPlayer.currentTime = 0;
  mockPlayer.listeners.clear();
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
  shape: { strokes: [{ mirror: true, points: [{ at: 46 }, { at: 52 }] }] },
  color: null,
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
      shape: null,
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

/** A face tracker that finds the canonical face only in `faces`, as one hidden elsewhere would. */
function trackFacesIn(faces: readonly string[]) {
  mockTracker.value = {
    detectFaceAsync: jest.fn((uri: string) => {
      const { canonicalFaceMesh } =
        jest.requireActual<typeof import('@/lib/face-mesh')>('@/lib/face-mesh');
      return Promise.resolve(
        faces.includes(uri)
          ? {
              points: canonicalFaceMesh.textureCoordinates.flatMap((point) => [point.x, point.y]),
              width: 1000,
              height: 1000,
            }
          : null,
      );
    }),
  };
}

test('uses the middle or end of a segment when its start hides the face', async () => {
  trackFacesIn(['file:///frame-750.jpg', 'file:///frame-8700.jpg']);
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
    { video: { uri: 'file:///video.mov', marks: [1500, 4000], durationMs: 9000 } },
  );
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  // 0:00–0:01.5 finds the face in its middle and 0:04–0:09 just before its end; 0:01.5–0:04 shows
  // none, so it keeps its start.
  const images = () => (latest ?? null)?.steps.map((step) => step.image);
  expect(images()).toEqual([
    'file:///frame-750.jpg',
    'file:///frame-1500.jpg',
    'file:///frame-8700.jpg',
  ]);
});

const analysis: PostAnalysis = {
  title: 'ナチュラルメイク',
  summary: '',
  steps: [
    {
      start: 26,
      end: 62,
      part: 'lash',
      description: '目尻にラインを引く',
      color: '#1A1A1A',
      regions: [],
      cosmetics: [1],
    },
    {
      start: 0,
      end: 26,
      part: 'brow',
      description: '眉尻を描き足す',
      color: '#5A3D2B',
      regions: [
        {
          detail: '眉尻を外へ描き足す',
          side: 'both',
          start: 'browTail',
          end: 'none',
          shape: 'line',
          length: 'short',
          direction: 'outward',
          clip: 'none',
        },
      ],
      cosmetics: [0],
    },
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
  expect(alert.mock.calls.at(-1)?.[1]).toBe(
    'サーバーに送信しGeminiで動画より手順と使ったコスメを読み取ります。動画はサーバーに残しません。',
  );
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
  // The area Gemini read becomes the step's shape; a step without one keeps none.
  expect(steps[0]?.shape?.strokes[0]?.mirror).toBe(true);
  expect(steps[1]?.shape).toBeNull();
  expect(draft()?.title).toBe('ナチュラルメイク');
  expect(jest.mocked(getThumbnailAsync).mock.calls.map(([, options]) => options?.time)).toEqual([
    0, 26_000,
  ]);
});

test('draws blush from the type Gemini chose, never from eye landmarks', async () => {
  const eyeRegion = {
    detail: '目の下に',
    side: 'both' as const,
    start: 'lowerLidEdge' as const,
    end: 'none' as const,
    shape: 'band' as const,
    length: 'medium' as const,
    direction: 'outward' as const,
    clip: 'none' as const,
  };
  const cheekStep = {
    part: 'cheek' as const,
    description: 'チークを入れる',
    color: '#E8968A',
    regions: [eyeRegion],
    cosmetics: [],
  };
  mockAnalyze.mockResolvedValue({
    ...analysis,
    steps: [
      { ...cheekStep, start: 0, end: 20, cheek: { style: 'triangle', size: 'large' } },
      // An answer without a type gets the plain round blush.
      { ...cheekStep, start: 20, end: 40 },
    ],
  });
  const draft = await renderCreating();
  await pressAlertButton('送る');
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/post/review');
  });
  const steps = draft()?.steps ?? [];
  expect(steps[0]?.shape).toEqual(cheekShape({ style: 'triangle', size: 'large' }));
  expect(steps[1]?.shape).toEqual(cheekShape(plainCheek));
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
    steps: [
      {
        start: 30,
        end: 10,
        part: 'brow',
        description: '',
        color: null,
        regions: [],
        cosmetics: [],
      },
    ],
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

test('adds a step on ⑫-4 over the start and end picked on the bar, and opens it', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostReview />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: '手順を追加' }));
  // It starts as the second half of the last step; a screen reader moves its start a second.
  expect(screen.getByText('1:35 〜 2:05')).toBeOnTheScreen();
  await fireEvent(screen.getByLabelText('区間の開始'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(screen.getByText('1:34 〜 2:05')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '追加' }));
  const steps = () => latest?.steps ?? [];
  // The last step is cut back to meet the new one.
  expect(steps().map((step) => [step.part, step.segment])).toEqual([
    ['brow', { startMs: 0, endMs: 65_000 }],
    ['cheek', { startMs: 65_000, endMs: 94_000 }],
    ['cheek', { startMs: 94_000, endMs: 125_000 }],
  ]);
  expect(steps()[2]).toMatchObject({ title: '', description: '', cosmetics: [], shape: null });
  expect(router.push).toHaveBeenCalledWith('/post/step/2');
  await waitFor(() => {
    expect(steps()[2]?.image).toBe('file:///frame-94000.jpg');
  });
  // The steps around it keep what they had.
  expect(steps()[1]?.title).toBe('頬に高めに');
});

test('closes the panel without adding a step when canceled', async () => {
  await renderSeeded(<PostReview />);
  await fireEvent.press(screen.getByRole('button', { name: '手順を追加' }));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByRole('button', { name: '手順を追加' })).toBeOnTheScreen();
  expect(screen.getByText('動画から2つの手順を作りました')).toBeOnTheScreen();
});

test('cannot add a step without a video to split', async () => {
  await renderSeeded(<PostReview />, { ...readyDraft, video: null });
  expect(screen.getByRole('button', { name: '手順を追加（準備中）' })).toBeDisabled();
});

test('picks the part of a step on ⑫-5 and drops the area read for the old part', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="0" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
  );
  const shape = () => latest?.steps[0]?.shape;
  expect(screen.getByText('0:00 〜 1:05')).toBeOnTheScreen();
  expect(screen.getByLabelText('タイトル')).toHaveProp('placeholder', '眉');
  expect(shape()).not.toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '部位' }));
  expect(screen.getByLabelText('タイトル')).toHaveProp('placeholder', 'リップ');
  expect(shape()).toBeNull();
});

test('plays the step on ⑫-5 from its start and stops at its end', async () => {
  await renderSeeded(<PostStepEdit index="1" />);
  mockPlayer.currentTime = 0;
  await fireEvent.press(screen.getByRole('button', { name: '区間を再生' }));
  expect(mockPlayer.currentTime).toBe(65);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockPlayer.listeners.get('timeUpdate')?.({ currentTime: 125 });
    await Promise.resolve();
  });
  expect(mockPlayer.pause).toHaveBeenCalled();
});

test('says so and cannot play when the video cannot be read', async () => {
  await renderSeeded(<PostStepEdit index="0" />);
  await act(async () => {
    mockPlayer.listeners.get('statusChange')?.({ status: 'error' });
    await Promise.resolve();
  });
  expect(screen.getByText('動画を再生できませんでした')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '区間を再生' })).toBeDisabled();
});

test('moves a step’s end on ⑫-5, moving the next step and cutting its frame again', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="0" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
  );
  // A screen reader moves the end of the bar a second at a time, as a drag would.
  await fireEvent(screen.getByLabelText('区間の終了'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  const steps = () => latest?.steps ?? [];
  expect(steps().map((step) => step.segment)).toEqual([
    { startMs: 0, endMs: 66_000 },
    { startMs: 66_000, endMs: 125_000 },
  ]);
  expect(screen.getByText('0:00 〜 1:06')).toBeOnTheScreen();
  await waitFor(() => {
    expect(steps()[1]?.image).toBe('file:///frame-66000.jpg');
  });
  // The step that kept its start keeps its frame.
  expect(steps()[0]?.image).toBe('file:///step-0.jpg');
});

test('keeps a step inside the video and at least a second long', async () => {
  await renderSeeded(<PostStepEdit index="0" />);
  await fireEvent(screen.getByLabelText('区間の開始'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(screen.getByText('0:00 〜 1:05')).toBeOnTheScreen();
  expect(getThumbnailAsync).not.toHaveBeenCalled();
});

test('shows the area read for the step on its frame and moves a picked point', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="0" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
  );
  const frame = await screen.findByTestId('塗る範囲の場面');
  await fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 300 } } });
  // The preview shows no points until 編集する.
  expect(screen.queryByRole('button', { name: '点1' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '編集する' }));
  // The brow's two points; the first is picked at first.
  expect(screen.getByRole('button', { name: '点1', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '次の点' }));
  expect(screen.getByRole('button', { name: '点2', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '右へ' }));
  await fireEvent.press(screen.getByRole('button', { name: '上へ' }));
  const shapeOf = () => latest?.steps[0]?.shape;
  const points = () => shapeOf()?.strokes[0]?.points ?? [];
  expect(points()[0]).toEqual({ at: 46 });
  expect(points()[1]?.dx).toBeCloseTo(0.004);
  expect(points()[1]?.dy).toBeCloseTo(-0.004);
  await fireEvent.press(screen.getByRole('button', { name: '前の点' }));
  expect(screen.getByRole('button', { name: '点1', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '太く' }));
  expect(shapeOf()?.strokes[0]?.width).toBeCloseTo(0.025);
  await fireEvent.press(screen.getByRole('button', { name: '完了' }));
  expect(screen.queryByRole('button', { name: '点1' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '編集する' }));
  await fireEvent.press(screen.getByRole('button', { name: '範囲を消す' }));
  expect(shapeOf()).toBeNull();
  expect(screen.getByText('この手順には塗る範囲がありません')).toBeOnTheScreen();
});

test('adds a plain area to a step without one and opens it for editing', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="1" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
    {
      ...readyDraft,
      steps: (readyDraft.steps ?? []).map((step) => ({ ...step, image: 'file:///step.jpg' })),
    },
  );
  expect(screen.getByText('この手順には塗る範囲がありません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '範囲を追加' }));
  const shape = () => latest?.steps[1]?.shape;
  // The cheek's plain area: an ellipse on both cheeks.
  expect(shape()?.strokes[0]).toMatchObject({ fill: true, mirror: true });
  const frame = await screen.findByTestId('塗る範囲の場面');
  await fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 300 } } });
  expect(screen.getByRole('button', { name: '点1', selected: true })).toBeOnTheScreen();
});

test('shows the area on the nearest step’s frame when this step’s shows no face', async () => {
  trackFacesIn(['file:///face.jpg']);
  const steps = readyDraft.steps ?? [];
  await renderSeeded(<PostStepEdit index="0" />, {
    ...readyDraft,
    steps: steps.map((step, index) => ({
      ...step,
      image: index === 0 ? 'file:///hidden.jpg' : 'file:///face.jpg',
    })),
  });
  expect(
    await screen.findByText('この手順の場面に顔が写っていないため、手順2の場面で表示しています'),
  ).toBeOnTheScreen();
  const frame = await screen.findByTestId('塗る範囲の場面');
  await fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 300, height: 300 } } });
  await fireEvent.press(screen.getByRole('button', { name: '編集する' }));
  expect(screen.getByRole('button', { name: '点1', selected: true })).toBeOnTheScreen();
});

test('says so when no step’s frame shows a face', async () => {
  trackFacesIn([]);
  await renderSeeded(<PostStepEdit index="0" />, {
    ...readyDraft,
    steps: (readyDraft.steps ?? []).map((step) => ({ ...step, image: 'file:///hidden.jpg' })),
  });
  expect(
    await screen.findByText('手順の場面から顔を見つけられなかったため、塗る範囲を表示できません'),
  ).toBeOnTheScreen();
});

test('says why the area cannot be shown', async () => {
  mockTracker.value = null;
  await renderSeeded(<PostStepEdit index="0" />);
  expect(screen.getByText('この環境では塗る範囲を表示できません')).toBeOnTheScreen();
});

test('shows the color read from the video on ⑫-5 and keeps the one picked', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="0" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
    {
      ...readyDraft,
      steps: (readyDraft.steps ?? []).map((step) => ({
        ...step,
        color: { hex: '#5A3D2B', picked: false },
      })),
    },
  );
  expect(screen.getByText(/動画から読み取った色です/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '色を選ぶ' }));
  // A touch on the square's top right corner picks the hue at full saturation and brightness.
  await fireEvent(screen.getByLabelText('鮮やかさと明るさ'), 'layout', {
    nativeEvent: { layout: { width: 332, height: 300 } },
  });
  await fireEvent(screen.getByLabelText('鮮やかさと明るさ'), 'responderGrant', {
    nativeEvent: { locationX: 320, locationY: 0 },
  });
  expect(screen.getByLabelText('鮮やかさと明るさ')).toHaveAccessibilityValue({
    text: '鮮やかさ100、明るさ100',
  });
  // The screen reader's actions change it too.
  await fireEvent(screen.getByLabelText('鮮やかさと明るさ'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  await fireEvent.press(screen.getByRole('button', { name: '決定' }));
  const first = () => (latest ?? null)?.steps[0];
  expect(first()?.color?.picked).toBe(true);
  // #5A3D2B's hue (23) at full saturation and 95 brightness.
  expect(first()?.color?.hex).toBe('#F25D00');
  expect(screen.getByText('選んだ色で塗ります')).toBeOnTheScreen();
});

test('asks to pick a color the video did not show', async () => {
  await renderSeeded(<PostStepEdit index="0" />);
  expect(screen.getByText(/動画から色を読み取れませんでした/)).toBeOnTheScreen();
});

test('deletes a step on ⑫-5 after asking and returns to ⑫-4', async () => {
  let latest: PostDraft | null = null;
  await renderSeeded(
    <>
      <PostStepEdit index="0" />
      <DraftProbe
        onDraft={(draft) => {
          latest = draft;
        }}
      />
    </>,
  );
  const steps = () => latest?.steps ?? [];
  await fireEvent.press(screen.getByRole('button', { name: 'この手順を削除' }));
  expect(alert.mock.calls.at(-1)?.[0]).toBe('この手順を削除しますか？');
  await pressAlertButton('キャンセル');
  expect(steps()).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: 'この手順を削除' }));
  await pressAlertButton('削除');
  // The cheek step is left, with its own segment; the brow's time is covered by no step.
  expect(steps().map((step) => [step.part, step.segment])).toEqual([
    ['cheek', { startMs: 65_000, endMs: 125_000 }],
  ]);
  expect(router.back).toHaveBeenCalled();
});

test('keeps the last step of a recipe', async () => {
  await renderSeeded(<PostStepEdit index="0" />, {
    ...readyDraft,
    steps: (readyDraft.steps ?? []).slice(0, 1),
  });
  expect(screen.getByRole('button', { name: 'この手順を削除' })).toBeDisabled();
});

test('shows every step’s area on the sample face on ⑫-8, and nothing without one', async () => {
  await renderSeeded(<PostPreview />);
  // Only the brow has an area in this draft.
  expect(screen.getByLabelText('見本の顔に1つの手順の塗る範囲を重ねた図')).toBeOnTheScreen();
  await renderSeeded(<PostPreview />, {
    ...readyDraft,
    steps: (readyDraft.steps ?? []).map((step) => ({ ...step, shape: null })),
  });
  expect(screen.queryByLabelText(/塗る範囲を重ねた図/)).toBeNull();
});

test('asks before posting and sends the steps and thumbnail, never the video', async () => {
  const { invalidate } = await renderSeeded(<PostPreview />);
  expect(screen.getByText('狐メイク')).toBeOnTheScreen();
  // ⑫-8 lists the published cosmetics as ⑤ will (#224).
  expect(screen.getByText('ふんわりチーク')).toBeOnTheScreen();
  expect(screen.getByText('チーク・01')).toBeOnTheScreen();
  expect(screen.getByText('プレビュー')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(alert).toHaveBeenCalledWith(
    'レシピを投稿しますか？',
    'サムネイルと手順が、だれでも見られるように公開されます。',
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
          shape: brow.shape,
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
      // The published cosmetics ⑤ lists (#224).
      products: [{ name: 'ふんわりチーク', part: 'cheek', usage: 'チーク・01' }],
      thumbnail: '/9j/file:///thumb.jpg',
    },
  });
  expect(JSON.stringify(mockPost.mock.calls)).not.toContain('video.mov');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recipes'] });

  // Coming back to ⑫-8 after posting does not post again.
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  expect(mockPost).toHaveBeenCalledTimes(1);
});

test('keeps unpublished cosmetics off ⑫-8 and out of the post', async () => {
  await renderSeeded(<PostPreview />, { ...readyDraft, publishCosmetics: false });
  expect(screen.queryByText('チーク・01')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
  expect(JSON.stringify(mockPost.mock.calls)).not.toContain('products');
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

test('posts the color read from the video or picked on ⑫-5 over the cosmetic and part colors', async () => {
  const [first, second] = readyDraft.steps ?? [];
  if (!first || !second) {
    throw new Error('readyDraft needs two steps');
  }
  await renderSeeded(<PostPreview />, {
    ...readyDraft,
    steps: [
      { ...first, color: { hex: '#1A1A1A', picked: false } },
      { ...second, color: { hex: '#C0392B', picked: true } },
    ],
  });
  await fireEvent.press(screen.getByRole('button', { name: '投稿' }));
  await pressAlertButton('投稿する');
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalled();
  });
  expect(mockPost.mock.calls[0]?.[0]).toMatchObject({
    json: { steps: [{ color: '#1A1A1A' }, { color: '#C0392B' }] },
  });
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
