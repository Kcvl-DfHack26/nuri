import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

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
    FieldGroup: { Section: View },
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
    useSession: () => ({
      data: { user: { id: 'viewer' }, session: { id: 'session' } },
      isPending: false,
    }),
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
      return { remove: jest.fn() };
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

function renderWithClient(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
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
  mockGetLastResponse.mockReturnValueOnce(tap({ kind: 'post-liked', recipientId: 'viewer' }));
  await renderWithClient(<PushNotifications />);
  await waitFor(() => {
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/users/[id]',
      params: { id: 'viewer' },
    });
  });
  expect(mockClearResponse).toHaveBeenCalledTimes(1);

  await act(() => {
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
