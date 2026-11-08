import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { Account } from './account';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => mockCanGoBack() },
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/google-sign-in', () => ({ signInWithGoogle: () => mockGoogle() }));
jest.mock('@/lib/passkeys', () => ({
  passkeysAvailable: true,
  signInWithPasskey: jest.fn(async () => {}),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    getSession: () => mockGetSession(),
  },
  api: {
    api: {
      'auth-capabilities': {
        $get: async () => ({
          ok: true,
          json: async () => ({ google: true, email: true, emulated: false }),
        }),
      },
    },
  },
}));
const mockGoogle = jest.fn(async () => {});
const mockCanGoBack = jest.fn(() => true);
const mockGetSession = jest.fn(async (): Promise<{ data: { user: { id: string } } | null }> => ({
  data: { user: { id: 'viewer' } },
}));

beforeEach(() => {
  // Let Testing Library flush React Query's scheduled notifications inside act.
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

function renderAccount() {
  return render(<Account />, { wrapper: TestQueryProvider });
}

test('shows the supported methods and returns after Google login', async () => {
  await renderAccount();
  const google = await screen.findByRole('button', { name: 'Googleで続ける' });
  expect(screen.queryByRole('button', { name: 'Appleで続ける' })).toBeNull();
  expect(screen.getByRole('button', { name: 'パスキーでログイン' })).toBeOnTheScreen();
  await fireEvent.press(google);
  await waitFor(() => {
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Googleで続ける' })).toBeEnabled();
  });
  expect(mockGoogle).toHaveBeenCalled();
});

test('does not offer email login even when the API advertises it', async () => {
  await renderAccount();
  await screen.findByRole('button', { name: 'Googleで続ける' });
  expect(screen.queryByRole('button', { name: 'メールアドレスで続ける' })).toBeNull();
  expect(screen.queryByLabelText('メールアドレス')).toBeNull();
});

test('continues as a guest by going back', async () => {
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'ゲストで参加' }));
  expect(router.back).toHaveBeenCalled();
});

test('stays on the login screen when the OS login browser is dismissed', async () => {
  mockGetSession.mockResolvedValueOnce({ data: null });
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'Googleで続ける' }));
  // Wait for the login attempt to settle so its state update happens inside the test.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Googleで続ける' })).toBeEnabled();
  });
  expect(mockGoogle).toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('goes to the make home when the login screen has no history', async () => {
  mockCanGoBack.mockReturnValueOnce(false);
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'ゲストで参加' }));
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(router.back).not.toHaveBeenCalled();
});
