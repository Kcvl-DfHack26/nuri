import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RecipeDetail } from './recipe-detail';

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

beforeEach(() => {
  jest.clearAllMocks();
});

test('opens the product sheet from a product row on the recipe', async () => {
  await render(<RecipeDetail id="fox" />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'CELANE 極細アイブロウペンシル、眉・モカブラウン' }),
  );
  expect(router.push).toHaveBeenCalledWith('/products/celane-brow-pencil');
  expect(
    screen.getByRole('button', { name: 'ムースチーク、チーク・コーラル（準備中）' }),
  ).toBeDisabled();
});
