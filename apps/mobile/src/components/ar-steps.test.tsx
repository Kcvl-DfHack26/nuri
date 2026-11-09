import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { ArSteps } from './ar-steps';

// The live camera needs the native face tracker and Skia; Expo Go and Jest use Plan A's photo.
jest.mock('@/components/face-makeup-camera', () => ({
  canTrackFace: false,
  FaceMakeupCamera: () => null,
}));
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
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  api: { api: { recipes: { ':id': { $get: () => mockGetRecipe() } } } },
}));

const fox = {
  id: 'fox',
  title: '狐メイク',
  steps: [
    {
      part: 'brow',
      label: '眉',
      title: '眉尻を濃く、眉頭は淡く',
      hint: 'スクリューブラシで眉頭の毛を立てる',
      product: 'アイブロウ（微アーチ眉）',
      colors: ['#79513A'],
    },
    {
      part: 'eye',
      label: 'シャドウ',
      title: '目尻側から横長にぼかす',
      hint: '中間・締め色は目頭側へ薄く',
      product: 'アイシャドウ（ベース・中間・締め）',
      colors: ['#E5B58A', '#C56D42', '#713E2C'],
    },
    {
      part: 'cheek',
      label: 'チーク',
      title: 'こめかみへ斜め上に滑らせる',
      hint: '頬骨の高い位置から丸く広げない',
      product: 'チーク',
      colors: ['#B8754F'],
    },
  ],
};
type Response = { ok: boolean; status: number; json: () => Promise<unknown> };
const mockGetRecipe = jest.fn(async (): Promise<Response> => ({
  ok: true,
  status: 200,
  json: async () => ({ recipe: fox }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('moves through the API steps with next, previous and the step list', async () => {
  await render(<ArSteps id="fox" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('眉尻を濃く、眉頭は淡く')).toBeOnTheScreen();
  expect(screen.getByText('1/3')).toBeOnTheScreen();
  expect(screen.getByText('おすすめ色 ブラウン')).toBeOnTheScreen();
  // Plan A's 再生 chip is gone: model videos are not built (#224).
  expect(screen.queryByLabelText('お手本を再生（準備中）')).toBeNull();
  expect(screen.getByRole('button', { name: '前の手順' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '次へ' }));
  expect(screen.getByText('目尻側から横長にぼかす')).toBeOnTheScreen();
  expect(screen.getByText('2/3')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '前の手順' }));
  expect(screen.getByText('眉尻を濃く、眉頭は淡く')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '3 チーク' }));
  expect(screen.getByText('こめかみへ斜め上に滑らせる')).toBeOnTheScreen();
});

test('opens the finish screen after the last step', async () => {
  await render(<ArSteps id="fox" />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: '3 チーク' }));
  expect(router.replace).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: '次へ' }));
  expect(router.replace).toHaveBeenCalledWith('/recipes/fox/finish');
});

test('shows a way back for a recipe that is missing or has no steps', async () => {
  mockGetRecipe.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
  await render(<ArSteps id="missing" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('手順が見つかりません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();

  mockGetRecipe.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ recipe: { ...fox, id: 'round', steps: [] } }),
  });
  await render(<ArSteps id="round" />, { wrapper: TestQueryProvider });
  expect(await screen.findByText('手順が見つかりません')).toBeOnTheScreen();
});

test('retries a failed load', async () => {
  mockGetRecipe.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<ArSteps id="fox" />, { wrapper: TestQueryProvider });
  expect(
    await screen.findByText('手順を読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByText('眉尻を濃く、眉頭は淡く')).toBeOnTheScreen();
});
