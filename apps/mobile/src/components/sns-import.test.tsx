import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { READING_STAGE_MS, SnsImport } from './sns-import';
import { SnsImportSteps } from './sns-import-steps';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => true,
  },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

async function finishReading() {
  for (let stage = 0; stage < 3; stage += 1) {
    await act(async () => {
      jest.advanceTimersByTime(READING_STAGE_MS);
    });
  }
}

test('reads a supported URL into the fixed sample and saves it', async () => {
  await render(<SnsImport saved={false} />);
  expect(screen.getByRole('button', { name: '読み取る' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'コピーしたリンクを使う（準備中）' })).toBeDisabled();

  await fireEvent.changeText(
    screen.getByLabelText('投稿のURL'),
    'https://www.instagram.com/reel/yuna_makeup/',
  );
  await fireEvent.press(screen.getByRole('button', { name: '読み取る' }));
  expect(screen.getByText('読み取り中')).toBeOnTheScreen();
  expect(screen.getByLabelText('投稿を開く、実行中')).toBeOnTheScreen();

  await act(async () => {
    jest.advanceTimersByTime(READING_STAGE_MS);
  });
  expect(screen.getByLabelText('投稿を開く、完了')).toBeOnTheScreen();
  expect(screen.getByLabelText('メイクの手順を探す、実行中')).toBeOnTheScreen();

  await finishReading();
  expect(screen.getByText('読み取り完了')).toBeOnTheScreen();
  expect(screen.getByText('手順を5つ見つけました')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^読み取った手順を確認/ }));
  expect(router.push).toHaveBeenCalledWith('/import/steps');

  await fireEvent.press(screen.getByRole('button', { name: 'レシピとして保存' }));
  expect(screen.getByText('レシピに保存しました')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '自分の顔で試す（準備中）' })).toBeDisabled();
});

test('cancelling stops reading and keeps the URL', async () => {
  await render(<SnsImport saved={false} />);
  await fireEvent.changeText(screen.getByLabelText('投稿のURL'), 'https://youtu.be/abc');
  await fireEvent.press(screen.getByRole('button', { name: '読み取る' }));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  await finishReading();

  expect(screen.queryByText('読み取り完了')).not.toBeOnTheScreen();
  expect(screen.getByLabelText('投稿のURL')).toHaveDisplayValue('https://youtu.be/abc');
  expect(screen.getByRole('button', { name: '読み取る' })).toBeEnabled();
});

test('shows ④-E for an unsupported URL and returns to the input', async () => {
  await render(<SnsImport saved={false} />);
  await fireEvent.changeText(screen.getByLabelText('投稿のURL'), 'https://example.com/video/1');
  await fireEvent.press(screen.getByRole('button', { name: '読み取る' }));
  expect(screen.getByText('この投稿は読み取れませんでした')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '別のURLを試す' }));
  expect(screen.queryByText('この投稿は読み取れませんでした')).not.toBeOnTheScreen();
  expect(screen.getByLabelText('投稿のURL')).toHaveDisplayValue('https://example.com/video/1');
});

test('shows ④-5 when ④-4 saved and closes the sheet', async () => {
  await render(<SnsImport saved />);
  expect(screen.getByText('レシピに保存しました')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(router.back).toHaveBeenCalled();
});

test('④-4 goes back to the sheet or saves into ④-5', async () => {
  await render(<SnsImportSteps />);
  expect(screen.getByLabelText('手順1、ベース、薄く全体に広げる、区間 0:48')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '手順を追加（準備中）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'レシピとして保存' }));
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/import', params: { saved: '1' } });
});
