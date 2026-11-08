import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createTestQueryClient } from '@/lib/test/query-client';

import { ProfileSettings } from './profile-settings';

jest.mock('@expo/ui', () => ({
  Icon: Object.assign(() => null, { select: () => 'icon' }),
  Host: jest.requireActual<typeof import('react-native')>('react-native').View,
  Switch: ({
    label,
    value,
    onValueChange,
    disabled,
  }: {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
  }) => {
    const { Switch } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    );
  },
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('@/components/feedback', () => ({
  Feedback: ({ message }: { message: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{message}</Text>;
  },
}));
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
  apiUrl: 'http://localhost:8080',
  api: {
    api: {
      me: {
        profile: {
          $get: () => mockGetProfile(),
          $patch: (input: { json: unknown }) => mockPutProfile(input),
        },
      },
    },
  },
  authClient: {
    useSession: () => mockUseSession(),
    $store: {
      notify: () => {
        mockNotify();
      },
    },
    signOut: () => mockSignOut(),
    listAccounts: () => mockAccounts(),
    passkey: {
      listUserPasskeys: () => mockPasskeys(),
      deletePasskey: (input: { id: string }) => mockDeletePasskey(input),
    },
  },
}));
jest.mock('@/lib/passkeys', () => ({
  ...jest.requireActual<typeof import('@/lib/passkeys')>('@/lib/passkeys'),
  addPasskey: () => mockAddPasskey(),
  passkeysAvailable: true,
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
beforeEach(() => {
  // Let Testing Library flush React Query's scheduled notifications inside act.
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  mockUseSession.mockImplementation(() => ({ ...viewer, isPending: false }));
});
const mockGetProfile = jest.fn(async () => ({
  status: 200,
  json: async () => ({ profile: { name: 'はなこ', handle: null, bio: '', isPublic: true } }),
}));
const mockPutProfile = jest.fn(async (_input: { json: unknown }) => ({ status: 200 }));
const mockAccounts = jest.fn(async () => ({
  data: [{ providerId: 'google' }],
  error: null,
}));
const mockPasskeys = jest.fn(async () => ({
  data: [{ id: 'key', name: 'この端末' }],
  error: null,
}));
const mockAddPasskey = jest.fn(async () => {});
const mockDeletePasskey = jest.fn(async (_input: { id: string }) => ({ error: null }));
const mockNotify = jest.fn();
const mockSignOut = jest.fn(async (): Promise<{ error: { message: string } | null }> => ({
  error: null,
}));

function renderWithClient(element: React.ReactElement, client = createTestQueryClient()) {
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

async function saveProfile() {
  await fireEvent.press(screen.getByRole('button', { name: '保存する' }));
  await waitFor(() => {
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '保存する' })).toBeOnTheScreen();
  });
}

test('saves profile fields and keeps unbuilt settings disabled', async () => {
  await renderWithClient(<ProfileSettings />);
  await screen.findByLabelText('表示名');
  expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '写真を変更（準備中）' })).toBeDisabled();
  expect(screen.getByLabelText('新着の通知（準備中）')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'メールアドレス hanako@example.com（準備中）' }),
  ).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('表示名'), 'はな');
  await fireEvent.changeText(screen.getByLabelText('ユーザーID'), 'hana_1');
  await fireEvent.changeText(screen.getByLabelText('自己紹介'), 'よろしく');
  await fireEvent(screen.getByLabelText('プロフィールを公開'), 'valueChange', false);
  await saveProfile();
  expect(mockPutProfile).toHaveBeenCalledWith({
    json: { name: 'はな', handle: 'hana_1', bio: 'よろしく', isPublic: false },
  });
  expect(mockNotify).toHaveBeenCalled();
});

test('adds and removes passkeys inline in the account section', async () => {
  await renderWithClient(<ProfileSettings />);
  expect(await screen.findByText('連携済み')).toBeOnTheScreen();
  expect(screen.queryByText('アプリの設定')).toBeNull();
  expect(screen.queryByRole('button', { name: 'この端末にパスキーを追加' })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'パスキー 1 件登録済み' }));

  const add = screen.getByRole('button', { name: 'この端末にパスキーを追加' });
  await fireEvent.press(add);
  await waitFor(() => {
    expect(mockAddPasskey).toHaveBeenCalled();
    expect(add).toBeEnabled();
  });

  mockPasskeys.mockResolvedValueOnce({ data: [], error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'この端末を削除' }));
  expect(await screen.findByRole('button', { name: 'パスキー 未登録' })).toBeOnTheScreen();
  expect(mockDeletePasskey).toHaveBeenCalledWith({ id: 'key' });
  expect(router.push).not.toHaveBeenCalled();
});

test('ignores legacy Apple accounts and shows an empty passkey list', async () => {
  mockAccounts.mockResolvedValueOnce({ data: [{ providerId: 'apple' }], error: null });
  mockPasskeys.mockResolvedValueOnce({ data: [], error: null });
  await renderWithClient(<ProfileSettings />);
  expect(await screen.findByText('未連携')).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'パスキー 未登録' })).toBeOnTheScreen();
});

test('logs out from the profile settings', async () => {
  await renderWithClient(<ProfileSettings />);
  await screen.findByLabelText('表示名');
  await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));
  await waitFor(() => {
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeEnabled();
  });
  expect(mockSignOut).toHaveBeenCalled();
});

test('explains invalid user IDs before saving', async () => {
  await renderWithClient(<ProfileSettings />);
  await screen.findByLabelText('ユーザーID');
  await fireEvent.changeText(screen.getByLabelText('ユーザーID'), 'Hana');
  expect(
    screen.getByText('ユーザーIDは半角英小文字・数字・_で3〜20文字にしてください'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
});

test('keeps a remote privacy change when saving only an edited name', async () => {
  const client = createTestQueryClient();
  await renderWithClient(<ProfileSettings />, client);
  await screen.findByLabelText('表示名');
  await act(async () => {
    client.setQueryData(['my-profile', 'viewer'], {
      name: 'はなこ',
      handle: null,
      bio: '',
      isPublic: false,
    });
  });
  await waitFor(() => {
    expect(screen.getByLabelText('プロフィールを公開')).toHaveProp('value', false);
  });
  await fireEvent.changeText(screen.getByLabelText('表示名'), '更新した名前');
  await saveProfile();
  expect(mockPutProfile).toHaveBeenLastCalledWith({ json: { name: '更新した名前' } });
});

test('saves a privacy change when the existing display name exceeds the edit limit', async () => {
  mockGetProfile.mockResolvedValueOnce({
    status: 200,
    json: async () => ({
      profile: { name: 'x'.repeat(41), handle: null, bio: '', isPublic: true },
    }),
  });
  await renderWithClient(<ProfileSettings />);
  await screen.findByLabelText('表示名');
  await fireEvent(screen.getByLabelText('プロフィールを公開'), 'valueChange', false);
  await saveProfile();
  expect(mockPutProfile).toHaveBeenLastCalledWith({ json: { isPublic: false } });
});

test('blocks saving a draft until a failed refresh is retried', async () => {
  const client = createTestQueryClient();
  await renderWithClient(<ProfileSettings />, client);
  await screen.findByLabelText('表示名');
  await fireEvent.changeText(screen.getByLabelText('表示名'), '編集中');
  mockGetProfile.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['my-profile'] });
  });
  const retry = await screen.findByRole('button', {
    name: '最新のプロフィールを読み込めませんでした。再試行',
  });
  expect(screen.getByLabelText('表示名')).toHaveProp('value', '編集中');
  expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
  await fireEvent.press(retry);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled();
  });
  expect(screen.getByLabelText('表示名')).toHaveProp('value', '編集中');
});

test('lets a guest log in from the profile settings', async () => {
  signOutForTest();
  await renderWithClient(<ProfileSettings />);
  expect(screen.queryByLabelText('表示名')).not.toBeOnTheScreen();
  expect(screen.queryByText('Google 連携')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(screen.queryByText('アプリの設定')).toBeNull();
});

test('keeps the edited name and shows why saving or logging out failed', async () => {
  mockPutProfile.mockResolvedValueOnce({ status: 500 });
  mockSignOut.mockResolvedValueOnce({ error: { message: 'failed' } });
  await renderWithClient(<ProfileSettings />);
  await screen.findByLabelText('表示名');
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
