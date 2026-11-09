import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { PartList } from './part-list';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  authClient: { useSession: () => ({ data: null }) },
  apiAssetUrl: (path: string) => path,
  api: { api: { recipes: { $get: () => mockGetRecipes() } } },
}));
const brow = (id: string, title: string, summary: string, tags: string[]) => ({
  id,
  title,
  summary,
  tags,
  image: `/sample-recipes/${id}.jpg`,
  likeCount: 10,
  author: { id: 'sample-mio', name: 'mio' },
});
const mockGetRecipes = jest.fn(async () => ({
  ok: true,
  json: async () => ({
    items: [
      brow('brow-straight-flat', '平行眉', 'やさしく若見え', ['初心者OK']),
      brow('brow-soft-arch', '微アーチ眉', '自然で垢抜け', ['初心者OK']),
      brow('brow-arch', 'アーチ眉', '女性らしく上品な', ['丸顔向け']),
    ],
    nextOffset: null,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('opens the recipe of the selected brow style', async () => {
  await render(<PartList part="brow" />, { wrapper: TestQueryProvider });
  expect(screen.getByRole('header', { name: '眉' })).toBeOnTheScreen();
  // The first recipe starts selected.
  expect(await screen.findByRole('radio', { name: '平行眉、やさしく若見え' })).toBeChecked();

  await fireEvent.press(screen.getByRole('radio', { name: '微アーチ眉、自然で垢抜け' }));
  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/brow-soft-arch');
});

test('filters the recipes with the chips by their tags', async () => {
  await render(<PartList part="brow" />, { wrapper: TestQueryProvider });
  expect(await screen.findAllByRole('radio')).toHaveLength(3);

  await fireEvent.press(screen.getByRole('radio', { name: '微アーチ眉、自然で垢抜け' }));
  await fireEvent.press(screen.getByRole('button', { name: '丸顔におすすめ' }));
  expect(screen.getByRole('button', { name: '丸顔におすすめ' })).toBeSelected();
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(
    screen.getByRole('radio', { name: 'アーチ眉、女性らしく上品な、丸顔におすすめ' }),
  ).toBeOnTheScreen();
  // The hidden selection stays, so the start button still opens its recipe.
  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/brow-soft-arch');

  await fireEvent.press(screen.getByRole('button', { name: 'すべて' }));
  expect(screen.getAllByRole('radio')).toHaveLength(3);
});

test('shows that a part has no recipes yet', async () => {
  mockGetRecipes.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ items: [], nextOffset: null }),
  });
  await render(<PartList part="lip" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('リップのレシピはまだありません')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'メイクをはじめる（準備中）' })).toBeDisabled();
});

test('shows a way back for an unknown part', async () => {
  await render(<PartList part="nose" />, { wrapper: TestQueryProvider });
  expect(screen.getByText('部位が見つかりません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
