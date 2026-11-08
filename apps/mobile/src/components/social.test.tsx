import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { FeedData } from '@/lib/social';

import { feedOptions } from '@/lib/social';
import { createTestQueryClient } from '@/lib/test/query-client';

import { Compose } from './compose';
import { Feed } from './feed';

jest.mock('@expo/ui', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Host: reactNative.View,
    Column: reactNative.View,
    Row: reactNative.View,
    Spacer: reactNative.View,
    Text: reactNative.Text,
    Icon: Object.assign(() => null, { select: () => 'icon' }),
    TextInput: reactNative.TextInput,
    Button: ({
      label,
      children,
      onPress,
      disabled,
    }: {
      label?: string;
      children?: React.ReactNode;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <reactNative.Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
      >
        {label ? <reactNative.Text>{label}</reactNative.Text> : children}
      </reactNative.Pressable>
    ),
  };
});
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@/components/avatar', () => ({
  Avatar: ({ image }: { image?: string | null }) => {
    mockAvatarRenders.push(image ?? 'none');
    return null;
  },
}));
const mockAvatarRenders: string[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: () => {},
}));
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  authClient: {
    useSession: () => ({
      data: mockLoggedIn
        ? { user: { id: 'viewer', name: 'はなこ', email: 'hanako@example.com' } }
        : null,
    }),
  },
  api: {
    api: {
      posts: {
        $get: () => mockGetPosts(),
        $post: () => mockCreatePost(),
        ':id': { like: { $put: () => mockLike(), $delete: () => mockLike() } },
      },
    },
  },
}));
let mockLoggedIn = false;
const mockGetPosts = jest.fn(async () => ({
  ok: true,
  json: async () => ({
    items: [
      {
        id: 'one',
        body: 'こんにちは',
        createdAt: '2026-11-06T00:00:00Z',
        author: { id: 'author', name: 'たろう', image: 'avatar-one' },
        likeCount: 2,
        liked: false,
      },
      {
        id: 'two',
        body: '別の投稿',
        createdAt: '2026-11-06T00:00:00Z',
        author: { id: 'another', name: 'ゆい', image: 'avatar-two' },
        likeCount: 5,
        liked: false,
      },
    ],
    nextOffset: null,
  }),
}));
const mockLike = jest.fn(async () => ({ ok: true }));
const mockCreatePost = jest.fn(async () => ({ status: 201 }));

function wrapper(client = createTestQueryClient()) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

test('shows a loading state, retries a failed feed, and prompts guests to log in before liking', async () => {
  mockLoggedIn = false;
  mockGetPosts.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<Feed />, { wrapper: wrapper() });
  await waitFor(() => {
    expect(
      screen.getByText('投稿を読み込めませんでした。通信状況を確認してお試しください。'),
    ).toBeOnTheScreen();
  });
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByText('こんにちは')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'いいね 2' }));
  expect(router.push).toHaveBeenCalledWith('/account');
});

test('keeps a failed post draft and allows a successful retry before dismissing', async () => {
  mockLoggedIn = true;
  mockCreatePost.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<Compose />, { wrapper: wrapper() });
  expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('投稿の本文'), '今日のできごと');
  await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
  expect(await screen.findByText('通信エラー')).toBeOnTheScreen();
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.getByText('7 / 500文字')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  await waitFor(() => {
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

test('optimistically updates only the liked row and cached profile without fetching the feed again', async () => {
  mockLoggedIn = true;
  const client = createTestQueryClient();
  await render(<Feed />, { wrapper: wrapper(client) });
  await screen.findByText('こんにちは');
  const homeKey = feedOptions('viewer').queryKey;
  const profileKey = feedOptions('viewer', 'author').queryKey;
  client.setQueryData<FeedData>(profileKey, client.getQueryData<FeedData>(homeKey));
  const otherRenders = mockAvatarRenders.filter((image) => image === 'avatar-two').length;
  const requests = mockGetPosts.mock.calls.length;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockLike.mockImplementationOnce(async () => {
    await pending;
    return { ok: true };
  });
  await fireEvent.press(screen.getByRole('button', { name: 'いいね 2' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね済み 3' })).toBeDisabled();
  });
  expect(screen.getByRole('button', { name: 'いいね 5' })).toBeEnabled();
  expect(client.getQueryData<FeedData>(profileKey)?.pages[0]?.items[0]).toMatchObject({
    liked: true,
    likeCount: 3,
  });
  expect(screen.getByTestId('timeline')).toHaveProp('refreshing', false);
  await act(async () => {
    release?.();
    await pending;
  });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね済み 3' })).toBeEnabled();
  });
  expect(mockGetPosts.mock.calls.length).toBe(requests);
  expect(mockAvatarRenders.filter((image) => image === 'avatar-two')).toHaveLength(otherRenders);
});

test('rolls back a failed like without undoing a concurrent successful like on another post', async () => {
  mockLoggedIn = true;
  await render(<Feed />, { wrapper: wrapper() });
  await screen.findByText('こんにちは');
  let reject: ((error: Error) => void) | undefined;
  mockLike.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'いいね 2' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね済み 3' })).toBeDisabled();
  });
  await fireEvent.press(screen.getByRole('button', { name: 'いいね 5' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね済み 6' })).toBeEnabled();
  });
  await act(async () => {
    reject?.(new Error('通信エラー'));
  });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね 2' })).toBeEnabled();
  });
  expect(screen.getByRole('button', { name: 'いいね済み 6' })).toBeEnabled();
  expect(screen.getByText('通信エラー')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'いいね済み 3' })).toBeEnabled();
  });
});

test('opens the author object from a post avatar', async () => {
  mockLoggedIn = false;
  await render(<Feed />, { wrapper: wrapper() });
  await fireEvent.press(await screen.findByRole('button', { name: 'たろうのプロフィール' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/users/[id]', params: { id: 'author' } });
});
