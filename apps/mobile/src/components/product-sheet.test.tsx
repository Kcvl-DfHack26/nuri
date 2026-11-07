import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ProductSheet } from './product-sheet';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
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

beforeEach(() => {
  jest.clearAllMocks();
});

test('switches the color and keeps unbuilt actions disabled', async () => {
  await render(<ProductSheet id="celane-brow-pencil" />);
  expect(screen.getByRole('header', { name: '極細アイブロウペンシル' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '03 モカブラウン' })).toBeChecked();

  await fireEvent.press(screen.getByRole('radio', { name: '05 ブラウンブラック' }));
  expect(screen.getByRole('radio', { name: '05 ブラウンブラック' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '03 モカブラウン' })).not.toBeChecked();
  expect(screen.getByText('05 ブラウンブラック')).toBeOnTheScreen();

  expect(screen.getByRole('button', { name: '購入先を見る（準備中）' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '自分の顔で色味を見る（準備中）' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '全18成分を見る（準備中）' })).toBeDisabled();
});

test('closes the sheet', async () => {
  await render(<ProductSheet id="celane-brow-pencil" />);
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(router.back).toHaveBeenCalled();
});

test('shows a way back for a product without details', async () => {
  await render(<ProductSheet id="mousse-cheek" />);
  expect(screen.getByText('商品が見つかりません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(router.back).toHaveBeenCalled();
});
