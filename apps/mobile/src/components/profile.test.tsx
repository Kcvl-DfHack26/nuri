import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { TestQueryProvider } from '@/lib/test/query-client';

import { Profile } from './profile';

jest.mock('@expo/ui', () => {
  const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Icon: Object.assign(() => null, { select: () => 'icon' }),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <reactNative.Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
      >
        <reactNative.Text>{label}</reactNative.Text>
      </reactNative.Pressable>
    ),
  };
});
jest.mock('@/components/native-host', () => ({
  NativeHost: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('@/theme/colors', () => ({
  colors: { background: '#f2f2f7', card: '#fff', secondary: '#777', separator: '#ccc' },
}));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  authClient: { useSession: () => ({ data: { user: { id: mockViewerId } } }) },
  api: {
    api: {
      recipes: { $get: () => mockRecipes() },
      users: { ':id': { $get: () => mockProfile() } },
    },
  },
}));
let mockViewerId = 'viewer';
const mockRecipes = jest.fn(async () => ({
  ok: true,
  json: async () => ({
    items: [
      {
        id: 'fox',
        title: '狐メイク',
        image: '/sample-recipes/fox.jpg',
        likeCount: 1200,
        favorited: false,
        author: { id: 'mio', name: 'mio' },
      },
    ],
    nextOffset: null,
  }),
}));
const mockProfile = jest.fn(async () => ({
  status: 200,
  json: async () => ({
    user: {
      id: 'mio',
      name: 'mio',
      image: null,
      handle: 'mio_make',
      bio: '丸顔さん向けのメイクを投稿しています',
      isPublic: true,
      followerCount: 1200,
      followingCount: 12,
      likeCount: 3400,
      following: false,
    },
  }),
}));

test("shows another user's counts, follow button and recipes, without the starter posts", async () => {
  await render(<Profile id="mio" />, { wrapper: TestQueryProvider });
  expect(await screen.findByRole('header', { name: 'mio' })).toBeOnTheScreen();
  expect(screen.getByText('@mio_make')).toBeOnTheScreen();
  expect(screen.getByText('丸顔さん向けのメイクを投稿しています')).toBeOnTheScreen();
  for (const label of ['フォロワー 1.2k', 'フォロー中 12', 'いいね 3.4k']) {
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  }
  expect(screen.getByRole('button', { name: 'フォロー' })).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: '投稿' })).toBeNull();

  await fireEvent.press(
    await screen.findByRole('button', { name: '狐メイク、mio、お気に入り1.2k' }),
  );
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
});

test('offers the settings instead of following on your own profile', async () => {
  mockViewerId = 'mio';
  await render(<Profile id="mio" />, { wrapper: TestQueryProvider });
  await fireEvent.press(await screen.findByRole('button', { name: 'プロフィール設定' }));
  expect(router.push).toHaveBeenCalledWith('/profile-settings');
  expect(screen.queryByRole('button', { name: 'フォロー' })).toBeNull();
  mockViewerId = 'viewer';
});
