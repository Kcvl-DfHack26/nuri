import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ArSteps } from './ar-steps';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

test('moves through the steps with next, previous and the step list', async () => {
  await render(<ArSteps id="fox" />);
  expect(screen.getByText('眉尻を濃く、眉頭は淡く')).toBeOnTheScreen();
  expect(screen.getByText('1/6')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '前の手順' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '次へ' }));
  expect(screen.getByText('目尻側から横長にぼかす')).toBeOnTheScreen();
  expect(screen.getByText('2/6')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '前の手順' }));
  expect(screen.getByText('眉尻を濃く、眉頭は淡く')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '4 シェード' }));
  expect(screen.getByText('骨の凹みに沿って滑らせる')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '6 リップ（準備中）' })).toBeDisabled();
});

test('opens the finish screen after the last step', async () => {
  await render(<ArSteps id="fox" />);
  await fireEvent.press(screen.getByRole('button', { name: '5 チーク' }));
  expect(screen.getByText('こめかみへ斜め上に滑らせる')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '次へ' }));
  expect(router.replace).toHaveBeenCalledWith('/recipes/fox/finish');
});

test('shows a way back for an unknown recipe', async () => {
  await render(<ArSteps id="missing" />);
  expect(screen.getByText('手順が見つかりません')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
