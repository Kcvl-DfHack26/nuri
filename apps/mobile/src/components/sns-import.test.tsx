import { fireEvent, render, screen } from '@testing-library/react-native';

import { backOrHome } from '@/lib/navigation';

import { SnsImport } from './sns-import';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@/lib/navigation', () => ({ backOrHome: jest.fn() }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

test('says importing from SNS is coming and points to posting a video', async () => {
  await render(<SnsImport />);
  expect(screen.getByRole('header', { name: '準備中' })).toBeOnTheScreen();
  expect(screen.getByText(/閉じて、「投稿」タブからレシピを作れます/)).toBeOnTheScreen();
  // The sample flow pretended to read a post and save a recipe; none of it remains.
  expect(screen.queryByLabelText('投稿のURL')).toBeNull();
  expect(screen.queryByRole('button', { name: '読み取る' })).toBeNull();
});

test('closes the sheet', async () => {
  await render(<SnsImport />);
  await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
  expect(backOrHome).toHaveBeenCalledTimes(1);
});
