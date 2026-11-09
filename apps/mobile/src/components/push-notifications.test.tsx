import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, Linking } from 'react-native';

import { TestQueryProvider } from '@/lib/test/query-client';

import { PushNotifications } from './push-notifications';
import { PushSettings } from './push-settings';

jest.mock('@expo/ui', () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
    Host: View,
    Text,
  };
});
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  useRootNavigationState: () => ({ key: 'root' }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'https://api.example.com',
  api: {
    api: {
      me: {
        'push-subscription': {
          $put: (input: unknown, options: unknown) => mockRegister(input, options),
        },
      },
    },
  },
  authClient: {
    useSession: () => mockUseSession(),
  },
}));
jest.mock('@/lib/notifications', () => ({
  pushAvailable: true,
  loadNotifications: async () => ({
    DEFAULT_ACTION_IDENTIFIER: 'default',
    AndroidImportance: { DEFAULT: 3 },
    setNotificationChannelAsync: async () => null,
    getPermissionsAsync: mockGetPermissions,
    requestPermissionsAsync: mockRequestPermissions,
    getExpoPushTokenAsync: async () => ({ data: 'ExpoPushToken[device]' }),
    getLastNotificationResponse: mockGetLastResponse,
    clearLastNotificationResponse: mockClearResponse,
    addNotificationResponseReceivedListener: (open: (response: Tap) => void) => {
      mockOpen = open;
      return { remove: mockRemoveResponseListener };
    },
  }),
}));

type Tap = ReturnType<typeof tap>;
function tap(data: unknown) {
  return { actionIdentifier: 'default', notification: { request: { content: { data } } } };
}
let mockOpen: ((response: Tap) => void) | undefined;
const mockGetPermissions = jest.fn(async () => ({ granted: false, canAskAgain: true }));
const mockRequestPermissions = jest.fn(async () => {
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
});
const mockRegister = jest.fn(async (_input: unknown, _options: unknown) => ({ ok: true }));
const mockGetLastResponse = jest.fn((): Tap | null => null);
const mockClearResponse = jest.fn();
const mockRemoveResponseListener = jest.fn();
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'viewer' }, session: { id: 'session' } },
  isPending: false,
}));

beforeEach(() => {
  mockOpen = undefined;
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockUseSession.mockReturnValue({
    data: { user: { id: 'viewer' }, session: { id: 'session' } },
    isPending: false,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderWithClient(element: React.ReactElement) {
  return render(element, { wrapper: TestQueryProvider });
}

test('requests OS permission from settings and registers the current session', async () => {
  await renderWithClient(<PushSettings sessionId="session" />);
  const enable = screen.getByRole('button', { name: '通知を有効にする' });
  await waitFor(() => {
    expect(enable).toBeEnabled();
  });
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockRegister).not.toHaveBeenCalled();

  await fireEvent.press(enable);
  expect(await screen.findByText('この端末で通知を受け取れます。')).toBeOnTheScreen();
  expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  expect(mockRegister).toHaveBeenCalledWith(
    { json: { token: 'ExpoPushToken[device]', sessionId: 'session' } },
    expect.anything(),
  );
});

test('consumes a cold-start tap and opens only validated routes for the signed-in account', async () => {
  mockGetLastResponse.mockReturnValueOnce(
    tap({ kind: 'recipe-liked', recipientId: 'viewer', recipeId: 'fox' }),
  );
  await renderWithClient(<PushNotifications />);
  await waitFor(() => {
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/recipes/[id]',
      params: { id: 'fox' },
    });
  });
  expect(mockClearResponse).toHaveBeenCalledTimes(1);

  await act(() => {
    mockOpen?.(tap({ kind: 'recipe-liked', recipientId: 'viewer' }));
    mockOpen?.(tap({ kind: 'post-liked', recipientId: 'viewer' }));
    mockOpen?.(tap({ kind: 'recipe-ready', recipientId: 'another-account', recipeId: 'fox' }));
    mockOpen?.(
      tap({ kind: 'recipe-ready', recipientId: 'viewer', recipeId: 'https://example.com' }),
    );
  });
  expect(router.navigate).toHaveBeenCalledTimes(1);

  await act(() => {
    mockOpen?.(tap({ kind: 'recipe-ready', recipientId: 'viewer', recipeId: 'fox' }));
    mockOpen?.(tap({ kind: 'recipe-failed', recipientId: 'viewer' }));
  });
  expect(router.navigate).toHaveBeenNthCalledWith(2, {
    pathname: '/recipes/[id]',
    params: { id: 'fox' },
  });
  expect(router.navigate).toHaveBeenLastCalledWith('/import');
});

test('opens OS settings when permission is blocked and refreshes registration on return', async () => {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const appState = jest.spyOn(AppState, 'addEventListener');
  const view = await renderWithClient(
    <>
      <PushNotifications />
      <PushSettings sessionId="session" />
    </>,
  );
  try {
    await fireEvent.press(await screen.findByRole('button', { name: '端末の通知設定を開く' }));
    await waitFor(() => {
      expect(openSettings).toHaveBeenCalledTimes(1);
    });
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    await act(() => {
      appState.mock.calls.find(([event]) => event === 'change')?.[1]('active');
    });
    expect(await screen.findByText('この端末で通知を受け取れます。')).toBeOnTheScreen();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  } finally {
    await view.unmount();
    openSettings.mockRestore();
    appState.mockRestore();
  }
});

test('removes the old response listener and rejects queued taps after switching accounts', async () => {
  const view = await renderWithClient(<PushNotifications />);
  await waitFor(() => {
    expect(mockOpen).toBeDefined();
  });
  const previousOpen = mockOpen;
  mockUseSession.mockReturnValue({
    data: { user: { id: 'another-account' }, session: { id: 'another-session' } },
    isPending: false,
  });
  await view.rerender(<PushNotifications />);
  await waitFor(() => {
    expect(mockRemoveResponseListener).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toBe(previousOpen);
  });
  await act(() => {
    previousOpen?.(tap({ kind: 'recipe-liked', recipientId: 'viewer', recipeId: 'fox' }));
    mockOpen?.(tap({ kind: 'recipe-liked', recipientId: 'viewer', recipeId: 'fox' }));
  });
  expect(router.navigate).not.toHaveBeenCalled();
  await act(() => {
    mockOpen?.(tap({ kind: 'recipe-liked', recipientId: 'another-account', recipeId: 'fox' }));
  });
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/recipes/[id]',
    params: { id: 'fox' },
  });
});

test('clears a registration error when returning to the app succeeds', async () => {
  mockRegister.mockResolvedValueOnce({ ok: false });
  const appState = jest.spyOn(AppState, 'addEventListener');
  await renderWithClient(
    <>
      <PushNotifications />
      <PushSettings sessionId="session" />
    </>,
  );
  const enable = screen.getByRole('button', { name: '通知を有効にする' });
  await waitFor(() => {
    expect(enable).toBeEnabled();
  });
  await fireEvent.press(enable);
  const error = '通知を設定できませんでした。時間をおいてもう一度お試しください。';
  expect(await screen.findByText(error)).toBeOnTheScreen();
  await act(() => {
    appState.mock.calls.find(([event]) => event === 'change')?.[1]('active');
  });
  expect(await screen.findByText('この端末で通知を受け取れます。')).toBeOnTheScreen();
  expect(screen.queryByText(error)).toBeNull();
});
