import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ProfileSettings } from './profile-settings';

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
    updateUser: (input: { name: string }) => mockUpdateUser(input),
    signOut: () => mockSignOut(),
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
const mockUpdateUser = jest.fn(
  async (_input: { name: string }): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const mockSignOut = jest.fn(async (): Promise<{ error: { message: string } | null }> => ({
  error: null,
}));

function renderWithClient(element: React.ReactElement) {
  const client = new QueryClient({
    // No garbage-collection timers, so Jest can exit after the run.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

test('saves a changed display name and keeps unbuilt settings disabled', async () => {
  await renderWithClient(<ProfileSettings />);
  expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '写真を変更（準備中）' })).toBeDisabled();
  expect(screen.getByLabelText('プロフィールを公開（準備中）')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'メールアドレス hanako@example.com（準備中）' }),
  ).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('表示名'), 'はな');
  await fireEvent.press(screen.getByRole('button', { name: '保存する' }));
  await waitFor(() => {
    expect(router.back).toHaveBeenCalled();
  });
  expect(mockUpdateUser).toHaveBeenCalledWith({ name: 'はな' });
});

test('opens the app settings and logs out from the profile settings', async () => {
  await renderWithClient(<ProfileSettings />);
  await fireEvent.press(screen.getByRole('button', { name: 'アプリの設定 外観・触覚・パスキー' }));
  expect(router.push).toHaveBeenCalledWith('/settings');

  await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));
  await waitFor(() => {
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });
  expect(mockSignOut).toHaveBeenCalled();
});

test('lets a guest log in or open the app settings from the profile settings', async () => {
  signOutForTest();
  await renderWithClient(<ProfileSettings />);
  expect(screen.queryByLabelText('表示名')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(screen.getByRole('button', { name: 'アプリの設定 外観・触覚・パスキー' })).toBeEnabled();
});

test('keeps the edited name and shows why saving or logging out failed', async () => {
  mockUpdateUser.mockResolvedValueOnce({ error: { message: 'failed' } });
  mockSignOut.mockResolvedValueOnce({ error: { message: 'failed' } });
  await renderWithClient(<ProfileSettings />);
  await fireEvent.changeText(screen.getByLabelText('表示名'), 'はな');
  await fireEvent.press(screen.getByRole('button', { name: '保存する' }));
  expect(
    await screen.findByText('変更を保存できませんでした。もう一度お試しください。'),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('表示名')).toHaveProp('value', 'はな');
  expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled();

  await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));
  expect(
    await screen.findByText('ログアウトできませんでした。もう一度お試しください。'),
  ).toBeOnTheScreen();
  expect(router.dismissTo).not.toHaveBeenCalled();
});
