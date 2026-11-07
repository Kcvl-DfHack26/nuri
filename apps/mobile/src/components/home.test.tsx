import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { Home } from './home';

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
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('opens the brow list from the part cards', async () => {
  await render(<Home />);
  await fireEvent.press(screen.getByRole('tab', { name: '部位 パーツ別' }));

  await fireEvent.press(screen.getByRole('button', { name: '眉、96レシピ' }));
  expect(router.push).toHaveBeenCalledWith('/parts/brow');
  expect(screen.getByRole('button', { name: 'リップ、187レシピ（準備中）' })).toBeDisabled();
});
