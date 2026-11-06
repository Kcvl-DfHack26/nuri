import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { Diagnosis } from './diagnosis';
import { Suggest } from './suggest';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useIsFocused: () => true,
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

test('opens the sample result from the previous diagnosis and keeps capture disabled', async () => {
  await render(<Suggest />);
  expect(screen.getByRole('button', { name: 'カメラで診断（準備中）' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '写真から診断（準備中）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '前回の診断（見本）' }));
  expect(router.push).toHaveBeenCalledWith('/diagnosis');
});

test('folds the brow finding and opens a recommended recipe', async () => {
  await render(<Diagnosis />);
  const brow = screen.getByRole('button', { name: '眉、眉尻を少し上げると、すっきり見えます' });
  expect(brow).toBeExpanded();
  expect(screen.getByText('少し上げた平行眉')).toBeOnTheScreen();

  await fireEvent.press(brow);
  expect(brow).toBeCollapsed();
  expect(screen.queryByText('少し上げた平行眉')).not.toBeOnTheScreen();

  await fireEvent.press(brow);
  expect(screen.getByText('少し上げた平行眉')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: '目元、目尻のラインで横幅を出します（準備中）' }),
  ).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '狐メイク、mio、相性94%' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
  expect(screen.queryByRole('button', { name: /丸顔メイク/ })).not.toBeOnTheScreen();
});

test('goes back from the result', async () => {
  await render(<Diagnosis />);
  expect(screen.getByRole('button', { name: '診断結果を共有（準備中）' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
