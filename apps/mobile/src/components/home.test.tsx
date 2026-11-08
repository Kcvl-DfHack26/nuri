import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { TestQueryProvider } from '@/lib/test/query-client';

import { Home } from './home';

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
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
    canGoBack: () => true,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  authClient: { useSession: () => ({ data: mockSignedIn ? { user: { id: 'viewer' } } : null }) },
  apiAssetUrl: (path: string) => path,
  api: {
    api: {
      recipes: {
        $get: () => mockGetRecipes(),
        ':id': { favorite: { $put: () => mockPutFavorite(), $delete: () => mockPutFavorite() } },
      },
      'recipe-parts': {
        $get: async () => ({
          ok: true,
          json: async () => ({ items: [{ part: 'brow', count: 6 }] }),
        }),
      },
    },
  },
}));
let mockSignedIn = false;
const mockPutFavorite = jest.fn(async () => ({ ok: true, status: 200 }));
type Response = { ok: boolean; json: () => Promise<unknown> };
const page = (items: unknown[]): Response => ({
  ok: true,
  json: async () => ({ items, nextOffset: null }),
});
const mockGetRecipes = jest.fn(async () =>
  page([
    {
      id: 'fox',
      title: '狐メイク',
      image: '/sample-recipes/fox.jpg',
      likeCount: 1200,
      favorited: false,
      author: { id: 'sample-mio', name: 'mio' },
    },
  ]),
);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  mockSignedIn = false;
});

test('retries a failed recipe list and opens a recipe from its card', async () => {
  mockGetRecipes.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<Home />, { wrapper: TestQueryProvider });
  expect(
    await screen.findByText('レシピを読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  await fireEvent.press(
    await screen.findByRole('button', { name: '狐メイク、mio、お気に入り1.2k' }),
  );
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
});

test('favorites a recipe from its card and rolls back when the server refuses', async () => {
  mockSignedIn = true;
  await render(<Home />, { wrapper: TestQueryProvider });
  const heart = await screen.findByRole('button', { name: '狐メイクをお気に入り' });
  expect(heart).not.toBeSelected();

  await fireEvent.press(heart);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '狐メイクをお気に入り' })).toBeSelected();
  });
  expect(mockPutFavorite).toHaveBeenCalledTimes(1);

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockPutFavorite.mockResolvedValueOnce({ ok: false, status: 500 });
  await fireEvent.press(screen.getByRole('button', { name: '狐メイクをお気に入り' }));
  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith(
      'お気に入りを変更できませんでした',
      'お気に入りを変更できませんでした。',
    );
  });
  expect(screen.getByRole('button', { name: '狐メイクをお気に入り' })).toBeSelected();
});

test('sends a guest to sign in from a card heart', async () => {
  await render(<Home />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: '狐メイクをお気に入り' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(mockPutFavorite).not.toHaveBeenCalled();
});

test('opens the search screen from the search field', async () => {
  await render(<Home />, { wrapper: TestQueryProvider });
  await fireEvent.press(screen.getByRole('button', { name: 'メイクを検索' }));
  expect(router.push).toHaveBeenCalledWith('/search');
});

test('shows an empty recipe list', async () => {
  mockGetRecipes.mockResolvedValueOnce(page([]));
  await render(<Home />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('レシピはまだありません')).toBeOnTheScreen();
});

test('keeps the chosen list in the route', async () => {
  await render(<Home />, { wrapper: TestQueryProvider });
  expect(screen.getByRole('tab', { name: '全体 顔まるごと' })).toBeSelected();
  expect(
    await screen.findByRole('button', { name: '狐メイク、mio、お気に入り1.2k' }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: '部位 パーツ別' }));
  expect(router.setParams).toHaveBeenCalledWith({ scope: 'parts' });
});

test('opens the brow list from the part cards', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ scope: 'parts' });
  await render(<Home />, { wrapper: TestQueryProvider });
  expect(screen.getByRole('tab', { name: '部位 パーツ別' })).toBeSelected();

  await fireEvent.press(await screen.findByRole('button', { name: '眉、6レシピ' }));
  expect(router.push).toHaveBeenCalledWith('/parts/brow');
  // Parts the API does not count have no recipes yet.
  expect(screen.getByRole('button', { name: 'リップ、0レシピ（準備中）' })).toBeDisabled();
});
