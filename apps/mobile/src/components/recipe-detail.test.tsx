import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

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
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  api: { api: { recipes: { ':id': { $get: () => mockGetRecipe() } } } },
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
  products: [
    {
      id: 'celane-brow-pencil',
      name: 'CELANE 極細アイブロウペンシル',
      image: null,
      purchasable: false,
      usage: '眉・モカブラウン',
    },
    {
      id: 'mousse-cheek',
      name: 'ムースチーク',
      image: null,
      purchasable: true,
      usage: 'チーク・コーラル',
    },
  ],
};
type Response = { ok: boolean; status: number; json: () => Promise<unknown> };
const mockGetRecipe = jest.fn(async (): Promise<Response> => ({
  ok: true,
  status: 200,
  json: async () => ({ recipe: fox }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows the recipe from the API and opens the product sheet from a product row', async () => {
  await render(<RecipeDetail id="fox" />, { wrapper });
  expect(await screen.findByText('狐メイク')).toBeOnTheScreen();
  expect(screen.getByText('＃丸顔向け')).toBeOnTheScreen();
  expect(screen.getByText('＃15分')).toBeOnTheScreen();
  expect(screen.getByText('6ステップ')).toBeOnTheScreen();
  expect(screen.getByText('Instagramから取り込み・保存 1.2k')).toBeOnTheScreen();
  expect(screen.getByText('2点')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: 'CELANE 極細アイブロウペンシル、眉・モカブラウン' }),
  );
  expect(router.push).toHaveBeenCalledWith('/products/celane-brow-pencil');
  expect(
    screen.getByRole('button', { name: 'ムースチーク、チーク・コーラル（準備中）' }),
  ).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox/steps');
});

test('keeps the start action disabled for a recipe without Plan A steps', async () => {
  mockGetRecipe.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ recipe: { ...fox, id: 'round', title: '丸顔メイク', products: [] } }),
  });
  await render(<RecipeDetail id="round" />, { wrapper });
  expect(await screen.findByText('丸顔メイク')).toBeOnTheScreen();
  expect(screen.queryByText('使うメイク品')).toBeNull();
  expect(screen.getByRole('button', { name: 'メイクをはじめる（準備中）' })).toBeDisabled();
});

test('retries a failed load and reports a missing recipe without retrying', async () => {
  mockGetRecipe.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<RecipeDetail id="fox" />, { wrapper });
  expect(
    await screen.findByText('レシピを読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByText('狐メイク')).toBeOnTheScreen();

  mockGetRecipe.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
  await render(<RecipeDetail id="missing" />, { wrapper });
  expect(await screen.findByText('レシピが見つかりません')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull();
});
