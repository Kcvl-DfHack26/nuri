import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';

import { TestQueryProvider } from '@/lib/test/query-client';

import { MakeCompare } from './make-compare';
import { MakeFinish } from './make-finish';

// The live camera needs the native face tracker and Skia; Expo Go and Jest use Plan A's photo.
// A test can switch to a stand-in camera to check what the live finish would paint.
let mockCanTrackFace = false;
const mockFaceMakeupCamera = jest.fn((_: { layers: readonly unknown[] }) => null);
jest.mock('@/components/face-makeup-camera', () => ({
  get canTrackFace() {
    return mockCanTrackFace;
  },
  FaceMakeupCamera: (props: { layers: readonly unknown[] }) => mockFaceMakeupCamera(props),
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
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  api: {
    api: {
      recipes: {
        ':id': { $get: () => mockGetRecipe() },
      },
    },
  },
}));

type Response = { ok: boolean; status: number; json: () => Promise<unknown> };
const mockGetRecipe = jest.fn(async (): Promise<Response> => ({
  ok: true,
  status: 200,
  json: async () => ({
    recipe: {
      id: 'fox',
      title: '狐メイク',
      author: { id: 'sample-mio', name: 'mio', image: null },
      steps: [
        { part: 'brow', label: '眉', colors: ['#79513A'] },
        { part: 'shading', label: 'シェード', colors: ['#A17B60'] },
      ],
    },
  }),
}));

test('shares the recipe as text from the finish screen, as Plan A has no way to ⑪', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await render(<MakeFinish id="fox" />, { wrapper: TestQueryProvider });
  expect(screen.queryByRole('button', { name: /メイク前と比べる/ })).toBeNull();
  expect(screen.getByRole('button', { name: '写真を保存（準備中）' })).toBeDisabled();
  await fireEvent.press(await screen.findByRole('button', { name: '共有', disabled: false }));
  expect(share).toHaveBeenCalledWith({ message: '狐メイク（mio）をnuriで試しました' });
});

test('shows the live finish at once and without step guides once the recipe loads', async () => {
  mockCanTrackFace = true;
  try {
    await render(<MakeFinish id="fox" />, { wrapper: TestQueryProvider });
    expect(screen.getByText('メイクのできあがり')).toBeOnTheScreen();
    expect(await screen.findByText('狐メイクのできあがり')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '共有', disabled: false })).toBeOnTheScreen();
    expect(mockFaceMakeupCamera.mock.lastCall?.[0].layers).toEqual([]);
  } finally {
    mockCanTrackFace = false;
  }
});

test('moves the divider with accessibility actions and goes back', async () => {
  await render(<MakeCompare id="fox" />, { wrapper: TestQueryProvider });
  const divider = screen.getByRole('adjustable', { name: 'メイク前とメイク後の境目' });
  expect(divider).toHaveAccessibilityValue({ text: 'メイク前50% メイク後50%' });

  await fireEvent(divider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(divider).toHaveAccessibilityValue({ text: 'メイク前60% メイク後40%' });
  await fireEvent(divider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  await fireEvent(divider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(divider).toHaveAccessibilityValue({ text: 'メイク前40% メイク後60%' });

  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});

test('shows unbuilt actions and layer toggles as disabled', async () => {
  await render(<MakeCompare id="fox" />, { wrapper: TestQueryProvider });
  expect(screen.getByRole('button', { name: '共有（準備中）' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '写真を保存（準備中）' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'レシピを投稿する（準備中）' })).toBeDisabled();
  expect(await screen.findByRole('checkbox', { name: '眉（準備中）' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'シェード（準備中）' })).not.toBeChecked();
});

test('retries the step layers when they fail to load', async () => {
  mockGetRecipe.mockRejectedValueOnce(new Error('通信エラー'));
  await render(<MakeCompare id="fox" />, { wrapper: TestQueryProvider });
  expect(
    await screen.findByText('手順を読み込めませんでした。通信状況を確認してお試しください。'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'もう一度試す' }));
  expect(await screen.findByRole('checkbox', { name: '眉（準備中）' })).toBeChecked();
});
