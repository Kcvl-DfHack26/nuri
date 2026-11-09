import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { RecipeSearch } from './recipe-search';

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
  authClient: { useSession: () => ({ data: null }) },
  apiAssetUrl: (path: string) => path,
  api: { api: { recipes: { $get: (args: unknown) => mockGetRecipes(args) } } },
}));
type Response = { ok: boolean; json: () => Promise<unknown> };
const page = (items: unknown[]): Response => ({
  ok: true,
  json: async () => ({ items, nextOffset: null }),
});
const mockGetRecipes = jest.fn(async (_args: unknown) =>
  page([
    {
      id: 'fox',
      title: '狐メイク',
      image: '/sample-recipes/fox.jpg',
      likeCount: 1200,
      author: { id: 'sample-mio', name: 'mio' },
    },
  ]),
);

beforeEach(() => {
  jest.clearAllMocks();
});

test('searches once typing pauses and opens a result', async () => {
  jest.useFakeTimers();
  try {
    await render(<RecipeSearch />, { wrapper: TestQueryProvider });
    expect(screen.getByText('レシピのタイトルやタグで探せます')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('メイクを検索'), ' 狐 ');
    expect(mockGetRecipes).not.toHaveBeenCalled();
    await act(() => {
      jest.advanceTimersByTime(300);
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: '狐メイク、mio、お気に入り1.2k' }),
    );
    expect(mockGetRecipes).toHaveBeenCalledTimes(1);
    expect(mockGetRecipes).toHaveBeenCalledWith({ query: { offset: '0', q: '狐' } });
    expect(router.push).toHaveBeenCalledWith('/recipes/fox');
  } finally {
    jest.useRealTimers();
  }
});

test('shows when nothing matches and goes back to home', async () => {
  mockGetRecipes.mockResolvedValueOnce(page([]));
  await render(<RecipeSearch />, { wrapper: TestQueryProvider });
  await fireEvent(screen.getByLabelText('メイクを検索'), 'changeText', '猫');
  await fireEvent(screen.getByLabelText('メイクを検索'), 'submitEditing');
  expect(await screen.findByText('「猫」に合うレシピはありません')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});

test('retries a failed search', async () => {
  mockGetRecipes.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<RecipeSearch />, { wrapper: TestQueryProvider });
  await fireEvent(screen.getByLabelText('メイクを検索'), 'changeText', '狐');
  await fireEvent(screen.getByLabelText('メイクを検索'), 'submitEditing');
  expect(
    await screen.findByText('レシピを探せませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(
    await screen.findByRole('button', { name: '狐メイク、mio、お気に入り1.2k' }),
  ).toBeOnTheScreen();
});
