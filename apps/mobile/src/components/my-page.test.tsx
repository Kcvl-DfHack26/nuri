import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { MyPage } from './my-page';

jest.mock('@expo/ui', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Icon: Object.assign(() => null, { select: () => 'icon' }),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <reactNative.Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
      >
        <reactNative.Text>{label}</reactNative.Text>
      </reactNative.Pressable>
    ),
  };
});
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => true,
  },
  useIsFocused: () => true,
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  authClient: {
    useSession: () => mockUseSession(),
  },
  api: {
    api: {
      recipes: { $get: () => mockPosted() },
      me: {
        favorites: { $get: () => mockFavorites() },
        profile: {
          $get: async () => ({
            status: 200,
            json: async () => ({ profile: { faceType: 'round' } }),
          }),
        },
      },
      users: { ':id': { $get: () => mockProfile() } },
    },
  },
}));
const recipe = (id: string, title: string) => ({
  id,
  title,
  image: `/sample-recipes/${id}.jpg`,
  likeCount: 1200,
  author: { id: 'viewer', name: 'はなこ' },
});
const page = (items: unknown[], nextOffset: number | null = null) => ({
  ok: true,
  json: async () => ({ items, nextOffset }),
});
const mockPosted = jest.fn(async () => page([recipe('own', '自分のメイク')]));
const mockFavorites = jest.fn(async () => page([recipe('fox', '狐メイク')]));
const mockProfile = jest.fn(async () => ({
  status: 200,
  json: async () => ({
    user: { id: 'viewer', followerCount: 328, followingCount: 96, likeCount: 2400 },
  }),
}));

type Session = { data: { user: { id: string; name: string; email: string } } | null };
const viewer: Session = {
  data: { user: { id: 'viewer', name: 'はなこ', email: 'hanako@example.com' } },
};
const mockUseSession = jest.fn((): Session & { isPending: boolean } => ({
  ...viewer,
  isPending: false,
}));
function signOutForTest() {
  mockUseSession.mockImplementation(() => ({ data: null, isPending: false }));
}
afterEach(() => {
  mockUseSession.mockImplementation(() => ({ ...viewer, isPending: false }));
});

test('shows the signed-in profile with posted and favorite recipes and opens them', async () => {
  await render(<MyPage />, { wrapper: TestQueryProvider });
  const posted = await screen.findByRole('button', {
    name: '自分のメイク、はなこ、お気に入り1.2k',
  });
  const favorite = await screen.findByRole('button', { name: '狐メイク、はなこ、お気に入り1.2k' });
  expect(screen.getByRole('header', { name: 'はなこ' })).toBeOnTheScreen();
  // The face type saved on ⑰-2 or from ⑭ shows under the name.
  expect(await screen.findByText('丸顔')).toBeOnTheScreen();
  // The counts come from the user's profile.
  for (const label of ['フォロワー 328', 'フォロー中 96', 'いいね 2.4k']) {
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  }
  expect(screen.queryByText(/見本です/)).toBeNull();

  await fireEvent.press(posted);
  expect(router.push).toHaveBeenCalledWith('/recipes/own');
  await fireEvent.press(favorite);
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');

  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定' }));
  expect(router.push).toHaveBeenCalledWith('/profile-settings');
});

test('loads more favorites past the first page', async () => {
  mockFavorites
    .mockResolvedValueOnce(page([recipe('fox', '狐メイク')], 20))
    .mockResolvedValueOnce(page([recipe('cat', '猫メイク')]));
  await render(<MyPage />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: 'もっと見る' }));
  expect(
    await screen.findByRole('button', { name: '猫メイク、はなこ、お気に入り1.2k' }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'もっと見る' })).toBeNull();
});

test('shows empty sections and retries a failed list', async () => {
  mockPosted.mockResolvedValueOnce(page([]));
  mockFavorites.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<MyPage />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('まだ投稿したレシピはありません')).toBeOnTheScreen();
  expect(
    await screen.findByText('お気に入りを読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(
    await screen.findByRole('button', { name: '狐メイク、はなこ、お気に入り1.2k' }),
  ).toBeOnTheScreen();
});

test('asks a guest to log in instead of showing a profile', async () => {
  signOutForTest();
  await render(<MyPage />, { wrapper: TestQueryProvider });
  expect(screen.getByText('ゲスト')).toBeOnTheScreen();
  expect(screen.queryByText('投稿')).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
  expect(router.push).toHaveBeenCalledWith('/account');
});

test('retries the follow and like counts when they fail to load', async () => {
  mockProfile.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<MyPage />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('フォロワーなどの数を読み込めませんでした。')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByLabelText('フォロワー 328')).toBeOnTheScreen();
});
