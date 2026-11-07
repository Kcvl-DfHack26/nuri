import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { MyPage } from './my-page';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => true,
  },
  useIsFocused: () => true,
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  authClient: {
    useSession: () => mockUseSession(),
  },
}));
type Session = { data: { user: { id: string; name: string; email: string } } | null };
const viewer: Session = {
  data: { user: { id: 'viewer', name: 'はなこ', email: 'hanako@example.com' } },
};
const mockUseSession = jest.fn((): Session & { isPending: boolean } => ({
  ...viewer,
  isPending: false,
}));
function signOutForTest() {
  mockUseSession.mockImplementation(() => ({ data: null, isPending: false }));
}
afterEach(() => {
  mockUseSession.mockImplementation(() => ({ ...viewer, isPending: false }));
});

test('shows the signed-in profile with sample numbers and opens the settings and a recipe', async () => {
  await render(<MyPage />);
  expect(screen.getByText('はなこ')).toBeOnTheScreen();
  expect(screen.getByLabelText('フォロワー 328')).toBeOnTheScreen();
  expect(screen.getByText('顔タイプ・数字・投稿は見本です')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '丸顔メイク、nana' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/round');
  await fireEvent.press(screen.getByRole('button', { name: '狐メイク、rina' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');

  await fireEvent.press(screen.getByRole('button', { name: 'プロフィール設定' }));
  expect(router.push).toHaveBeenCalledWith('/profile-settings');
});

test('asks a guest to log in instead of showing a profile', async () => {
  signOutForTest();
  await render(<MyPage />);
  expect(screen.getByText('ゲスト')).toBeOnTheScreen();
  expect(screen.queryByText('投稿')).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
  expect(router.push).toHaveBeenCalledWith('/account');
});
