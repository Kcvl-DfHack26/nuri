import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Alert } from 'react-native';

import { TestQueryProvider } from '@/lib/test/query-client';

import { RecipeDetail } from './recipe-detail';

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
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  authClient: { useSession: () => ({ data: mockSignedIn ? { user: { id: 'viewer' } } : null }) },
  api: {
    api: {
      recipes: {
        ':id': {
          $get: () => mockGetRecipe(),
          favorite: { $put: () => mockFavorite(true), $delete: () => mockFavorite(false) },
        },
      },
      users: {
        ':id': {
          $get: () => mockGetAuthor(),
          follow: { $put: () => mockFollow(true), $delete: () => mockFollow(false) },
        },
      },
    },
  },
}));
let mockSignedIn = false;
// The server's favorite, which ⑤ reads back once a change settles.
let mockServerFavorited = false;
const mockFavorite = jest.fn(async (favorited: boolean) => {
  mockServerFavorited = favorited;
  return { ok: true, status: 200 };
});
// The author's profile follows what the server accepted, as the refetch after a follow reads it.
let mockFollowing = false;
const mockFollow = jest.fn(async (following: boolean) => {
  mockFollowing = following;
  return { ok: true, status: 200 };
});
let mockAuthorId = 'sample-mio';
const mockGetAuthor = jest.fn(async () => ({
  status: 200,
  json: async () => ({
    user: {
      id: mockAuthorId,
      following: mockFollowing,
      followerCount: mockFollowing ? 4 : 3,
      followingCount: 0,
      likeCount: 1200,
    },
  }),
}));
const fox = {
  id: 'fox',
  title: '狐メイク',
  image: '/sample-recipes/fox.jpg',
  tags: ['丸顔向け'],
  durationMinutes: 15,
  likeCount: 1200,
  source: 'instagram',
  author: { id: 'sample-mio', name: 'mio', image: null },
  favorited: false,
  products: [
    {
      id: 'celane-brow-pencil',
      name: 'CELANE 極細アイブロウペンシル',
      image: null,
      purchaseUrl: null,
      usage: '眉・モカブラウン',
    },
    {
      id: 'mousse-cheek',
      name: 'ムースチーク',
      image: null,
      purchaseUrl: 'https://www.amazon.co.jp/s?k=cheek',
      usage: 'チーク・コーラル',
    },
  ],
  steps: [
    { part: 'brow', label: '眉' },
    { part: 'eye', label: 'シャドウ' },
    { part: 'lash', label: 'ライン' },
    { part: 'shading', label: 'シェード' },
    { part: 'cheek', label: 'チーク' },
  ],
};
type Response = { ok: boolean; status: number; json: () => Promise<unknown> };
const mockGetRecipe = jest.fn(async (): Promise<Response> => ({
  ok: true,
  status: 200,
  json: async () => ({ recipe: { ...fox, favorited: mockServerFavorited } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockServerFavorited = false;
});

test('shows the recipe from the API and opens the product sheet from a product row', async () => {
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('狐メイク')).toBeOnTheScreen();
  expect(screen.getByText('＃丸顔向け')).toBeOnTheScreen();
  expect(screen.getByText('＃15分')).toBeOnTheScreen();
  expect(screen.getByText('5ステップ')).toBeOnTheScreen();
  expect(screen.getAllByText('シェード').length).toBeGreaterThan(0);
  expect(await screen.findByText('フォロワー 3・お気に入り 1.2k')).toBeOnTheScreen();
  expect(screen.getByText('2点')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: 'CELANE 極細アイブロウペンシル、眉・モカブラウン' }),
  );
  expect(router.push).toHaveBeenCalledWith('/products/celane-brow-pencil');
  // A product without ⑥ is not a button itself; its 買う stays a button of its own.
  expect(screen.queryByRole('button', { name: /^ムースチーク/u })).toBeNull();
  // Only the product with a shop link offers 買う, and it opens the link in the browser.
  expect(screen.getAllByText('買う')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: '購入先を見る' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://www.amazon.co.jp/s?k=cheek');
  await fireEvent.press(screen.getByText('mio'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/users/[id]',
    params: { id: 'sample-mio' },
  });
  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox/steps');
});

test('keeps the start action disabled for a recipe without steps', async () => {
  mockGetRecipe.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      recipe: { ...fox, id: 'round', title: '丸顔メイク', products: [], steps: [] },
    }),
  });
  await render(<RecipeDetail id="round" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('丸顔メイク')).toBeOnTheScreen();
  expect(screen.queryByText('使うメイク品')).toBeNull();
  expect(screen.queryByText('手順')).toBeNull();
  expect(screen.getByRole('button', { name: 'メイクをはじめる（準備中）' })).toBeDisabled();
});

test('retries a failed load and reports a missing recipe without retrying', async () => {
  mockGetRecipe.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  expect(
    await screen.findByText('レシピを読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByText('狐メイク')).toBeOnTheScreen();

  mockGetRecipe.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
  await render(<RecipeDetail id="missing" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('レシピが見つかりません')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull();
});

test('sends a guest to log in before keeping a favorite', async () => {
  mockSignedIn = false;
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: 'お気に入り' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(mockFavorite).not.toHaveBeenCalled();
});

test('keeps a favorite at once and rolls it back when the server refuses', async () => {
  mockSignedIn = true;
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  const favorite = await screen.findByRole('button', { name: 'お気に入り' });
  expect(favorite).not.toBeSelected();
  await fireEvent.press(favorite);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'お気に入り' })).toBeSelected();
  });
  expect(mockFavorite).toHaveBeenCalledTimes(1);

  const alert = jest.spyOn(Alert, 'alert');
  mockFavorite.mockResolvedValueOnce({ ok: false, status: 500 });
  // The refused change leaves the server, and so ⑤ after its refetch, as it was.
  await fireEvent.press(screen.getByRole('button', { name: 'お気に入り' }));
  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith(
      'お気に入りを変更できませんでした',
      'お気に入りを変更できませんでした。',
    );
  });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'お気に入り' })).toBeSelected();
  });
  mockSignedIn = false;
});

test('follows the author from ⑤ at once and rolls it back when the server refuses', async () => {
  mockSignedIn = true;
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  const follow = await screen.findByRole('button', { name: 'フォロー' });
  expect(follow).not.toBeSelected();
  await fireEvent.press(follow);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeSelected();
  });
  expect(screen.getByText('フォロー中')).toBeOnTheScreen();
  expect(mockFollow).toHaveBeenCalledTimes(1);
  // The row stays one line of follower count and likes; the source is not shown (#212).
  expect(await screen.findByText('フォロワー 4・お気に入り 1.2k')).toBeOnTheScreen();

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockFollow.mockImplementationOnce(async () => ({ ok: false, status: 500 }));
  await fireEvent.press(screen.getByRole('button', { name: 'フォロー' }));
  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith(
      'フォローを変更できませんでした',
      'フォローを変更できませんでした。',
    );
  });
  expect(screen.getByRole('button', { name: 'フォロー' })).toBeSelected();
  mockSignedIn = false;
  mockFollowing = false;
});

test('shows only likes when the author has no profile to read', async () => {
  mockGetAuthor.mockImplementationOnce(async () => ({
    status: 404,
    json: async () => ({
      user: { id: '', following: false, followerCount: 0, followingCount: 0, likeCount: 0 },
    }),
  }));
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  await waitFor(() => {
    expect(mockGetAuthor).toHaveBeenCalled();
  });
  expect(await screen.findByText('お気に入り 1.2k')).toBeOnTheScreen();
  expect(screen.queryByText(/フォロワー/u)).toBeNull();
  expect(screen.queryByRole('button', { name: 'フォロー' })).toBeNull();
});

test('sends a guest to log in before following and hides the button on your own recipe', async () => {
  mockSignedIn = false;
  const view = await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: 'フォロー' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(mockFollow).not.toHaveBeenCalled();
  await view.unmount();

  mockSignedIn = true;
  mockAuthorId = 'viewer';
  await render(<RecipeDetail id="fox" />, { wrapper: TestQueryProvider });
  await screen.findByRole('header', { name: '狐メイク' });
  await waitFor(() => {
    expect(mockGetAuthor).toHaveBeenCalled();
  });
  expect(screen.queryByRole('button', { name: 'フォロー' })).toBeNull();
  mockSignedIn = false;
  mockAuthorId = 'sample-mio';
});
