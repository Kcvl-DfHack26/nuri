import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

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

beforeEach(() => {
  jest.clearAllMocks();
});

test('opens the recipe of the selected brow style', async () => {
  await render(<PartList part="brow" />);
  expect(screen.getByRole('header', { name: '眉' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '微アーチ眉、自然で垢抜け' })).toBeChecked();

  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
});

test('styles without a recipe disable the start button', async () => {
  await render(<PartList part="brow" />);
  await fireEvent.press(screen.getByRole('radio', { name: '平行眉、やさしく若見え' }));
  expect(screen.getByRole('radio', { name: '平行眉、やさしく若見え' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '微アーチ眉、自然で垢抜け' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'メイクをはじめる（準備中）' })).toBeDisabled();
});

test('filters the styles with the chips', async () => {
  await render(<PartList part="brow" />);
  expect(screen.getAllByRole('radio')).toHaveLength(6);

  await fireEvent.press(screen.getByRole('button', { name: '丸顔におすすめ' }));
  expect(screen.getByRole('button', { name: '丸顔におすすめ' })).toBeSelected();
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(
    screen.getByRole('radio', { name: '上がり眉、シャープで自信のある、丸顔におすすめ' }),
  ).toBeOnTheScreen();
  // The hidden selection stays, so the start button still opens its recipe.
  await fireEvent.press(screen.getByRole('button', { name: 'メイクをはじめる' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');

  await fireEvent.press(screen.getByRole('button', { name: 'すべて' }));
  expect(screen.getAllByRole('radio')).toHaveLength(6);
});

test('shows a way back for a part without a list', async () => {
  await render(<PartList part="lip" />);
  expect(screen.getByText('部位が見つかりません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
