import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

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

test('switches the color', async () => {
  await render(<ProductSheet id="celane-brow-pencil" />);
  expect(screen.getByRole('header', { name: '極細アイブロウペンシル' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '03 モカブラウン' })).toBeChecked();

  await fireEvent.press(screen.getByRole('radio', { name: '05 ブラウンブラック' }));
  expect(screen.getByRole('radio', { name: '05 ブラウンブラック' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '03 モカブラウン' })).not.toBeChecked();
  expect(screen.getByText('05 ブラウンブラック')).toBeOnTheScreen();
});

test('says the color check and the shop are coming', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await render(<ProductSheet id="celane-brow-pencil" />);

  await fireEvent.press(screen.getByRole('button', { name: '自分の顔で色味を見る（準備中）' }));
  expect(alert).toHaveBeenLastCalledWith(
    '準備中',
    '自分の顔で色味を確かめる機能は、いま準備しています。',
  );
  await fireEvent.press(screen.getByRole('button', { name: '購入先を見る（準備中）' }));
  expect(alert).toHaveBeenLastCalledWith('準備中', '購入先の案内は、いま準備しています。');
  // Listing every ingredient is not planned, so the sheet no longer offers it.
  expect(screen.queryByText(/成分を見る/)).toBeNull();
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

test('says the shop is coming on the web, where Alert does nothing', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'web');
  // The native test environment has no window.alert, so the test provides one.
  const original = window.alert;
  const alert = jest.fn();
  window.alert = alert;
  await render(<ProductSheet id="celane-brow-pencil" />);
  await fireEvent.press(screen.getByRole('button', { name: '購入先を見る（準備中）' }));
  expect(alert).toHaveBeenCalledWith('準備中\n購入先の案内は、いま準備しています。');
  window.alert = original;
  os.restore();
});
