import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PostDone } from './post-done';
import { PostDraftProvider } from './post-draft';
import { PostMessage } from './post-message';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@expo/ui', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Icon: Object.assign(() => null, { select: () => 'icon' }),
    Switch: ({
      label,
      value,
      onValueChange,
    }: {
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }) => (
      <reactNative.Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} />
    ),
  };
});

function renderInDraft(screenElement: React.ReactElement) {
  return render(<PostDraftProvider>{screenElement}</PostDraftProvider>);
}

test('edits the message and publish options in the draft before previewing', async () => {
  await renderInDraft(<PostMessage />);
  const message = screen.getByLabelText('メッセージ');
  await fireEvent.changeText(message, 'チークを高めに');
  expect(screen.getByText('7/200')).toBeOnTheScreen();

  const before = screen.getByLabelText('Before写真を公開');
  expect(before).toHaveProp('value', false);
  await fireEvent(before, 'valueChange', true);
  expect(screen.getByLabelText('Before写真を公開')).toHaveProp('value', true);

  await fireEvent.press(screen.getByRole('button', { name: 'プレビューを見る' }));
  expect(router.push).toHaveBeenCalledWith('/post/preview');
  expect(screen.getByRole('button', { name: 'タグを追加（準備中）' })).toBeDisabled();
});

test('returns to the step list from the guide summary', async () => {
  await renderInDraft(<PostMessage />);
  await fireEvent.press(screen.getByRole('button', { name: /^手順書 \d+ステップを確認する$/ }));
  expect(router.back).toHaveBeenCalled();
});

test('opens the sample recipe or goes home after posting', async () => {
  await renderInDraft(<PostDone />);
  expect(screen.getByText('投稿しました！')).toBeOnTheScreen();
  expect(screen.getByLabelText('動画 14:32')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '投稿を見る' }));
  expect(router.replace).toHaveBeenCalledWith('/recipes/fox');

  await fireEvent.press(screen.getByRole('button', { name: 'ホームに戻る' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');
});
