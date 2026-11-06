import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { Account } from './account';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'state' }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `com.kcvl.nuri://${path}` }));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}) }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/apple-button', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppleButton: ({ onPress }: { onPress: () => void }) => (
      <reactNative.Pressable accessibilityRole="button" onPress={onPress}>
        <reactNative.Text>Appleで続ける</reactNative.Text>
      </reactNative.Pressable>
    ),
  };
});
jest.mock('@/lib/passkeys', () => ({
  passkeysAvailable: true,
  signInWithPasskey: jest.fn(async () => {}),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    getSession: async () => ({ data: { user: { id: 'viewer' } } }),
    signIn: { social: () => mockSocial(), magicLink: () => mockMagicLink() },
  },
  api: {
    api: {
      'auth-capabilities': {
        $get: async () => ({
          ok: true,
          json: async () => ({ apple: true, google: true, email: true, emulated: false }),
        }),
      },
    },
  },
}));
const mockSocial = jest.fn(async () => ({ error: null }));
const mockMagicLink = jest.fn(async () => ({ error: null }));

function renderAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Account />
    </QueryClientProvider>,
  );
}

test('returns to the previous screen after a social login', async () => {
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'Googleで続ける' }));
  await waitFor(() => {
    expect(router.back).toHaveBeenCalled();
  });
  expect(mockSocial).toHaveBeenCalled();
});

test('opens the email form and sends a login link', async () => {
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'メールアドレスで続ける' }));
  expect(screen.getByRole('button', { name: 'ログインリンクを送信' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'hanako@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'ログインリンクを送信' }));
  expect(
    await screen.findByText('メールを送信しました。10分以内に、この端末でリンクを開いてください。'),
  ).toBeOnTheScreen();
  expect(mockMagicLink).toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});

test('continues as a guest by going back', async () => {
  await renderAccount();
  await fireEvent.press(await screen.findByRole('button', { name: 'ゲストで参加' }));
  expect(router.back).toHaveBeenCalled();
});
