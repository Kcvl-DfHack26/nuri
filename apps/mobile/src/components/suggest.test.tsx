import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { diagnoseFace } from '@/lib/face-diagnosis';

import { Diagnosis } from './diagnosis';
import { Suggest } from './suggest';

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
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  CameraType: { front: 'front' },
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../modules/face-tracker/src/FaceTrackerModule', () => ({
  __esModule: true,
  default: { detectFaceAsync: (uri: string) => mockDetect(uri) },
}));
jest.mock('@/lib/face-diagnosis', () => ({
  ...jest.requireActual<typeof import('@/lib/face-diagnosis')>('@/lib/face-diagnosis'),
  diagnoseFace: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  api: { api: { recipes: { $get: () => mockGetRecipes() } } },
}));

const landmarks = { points: [0.5, 0.5], width: 100, height: 100 };
const mockDetect = jest.fn<Promise<typeof landmarks | null>, [string]>();
const mockGetRecipes = jest.fn(async () => ({
  ok: true,
  json: async () => ({
    items: [
      {
        id: 'fox',
        title: '狐メイク',
        image: '/sample-recipes/fox.jpg',
        tags: ['時短'],
        likeCount: 1200,
        author: { id: 'sample-mio', name: 'mio' },
      },
      {
        id: 'round',
        title: '丸顔メイク',
        image: '/sample-recipes/round.jpg',
        tags: ['丸顔向け'],
        likeCount: 800,
        author: { id: 'sample-mio', name: 'mio' },
      },
    ],
    nextOffset: null,
  }),
}));
const pick = jest.mocked(launchImageLibraryAsync);
const diagnose = jest.mocked(diagnoseFace);
const params = jest.mocked(useLocalSearchParams);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///face.jpg', width: 100, height: 100 }],
  });
});

test('diagnoses a chosen photo on device and opens the result', async () => {
  mockDetect.mockResolvedValue(landmarks);
  diagnose.mockReturnValue({ kind: 'ok', faceType: 'round', brow: 'falling' });
  await render(<Suggest />);
  expect(screen.getByRole('button', { name: '前回の診断（まだありません）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/diagnosis',
      params: { face: 'round', brow: 'falling', photo: 'file:///face.jpg' },
    });
  });
  expect(mockDetect).toHaveBeenCalledWith('file:///face.jpg');

  await fireEvent.press(screen.getByRole('button', { name: '前回の診断' }));
  expect(router.push).toHaveBeenCalledTimes(2);
});

test('explains a photo without a face or a turned face', async () => {
  mockDetect.mockResolvedValueOnce(null);
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  expect(
    await screen.findByText('顔が見つかりませんでした。顔全体が写った写真で試してください'),
  ).toBeOnTheScreen();

  mockDetect.mockResolvedValueOnce(landmarks);
  diagnose.mockReturnValueOnce({ kind: 'notFrontal' });
  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  expect(await screen.findByText('正面を向いた写真で試してください')).toBeOnTheScreen();
  expect(router.push).not.toHaveBeenCalled();
});

test('explains when the photo cannot be taken or picked', async () => {
  pick.mockRejectedValueOnce(new Error('picker failed'));
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  expect(
    await screen.findByText('写真を用意できませんでした。もう一度お試しください'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '写真から診断' })).toBeEnabled();
});

test('shows the face type, the brows and recipes for that face type first', async () => {
  params.mockReturnValue({ face: 'round', brow: 'falling', photo: 'file:///face.jpg' });
  await render(<Diagnosis />, { wrapper });
  expect(screen.getByText('丸顔')).toBeOnTheScreen();
  expect(screen.getByText('下がり眉')).toBeOnTheScreen();
  expect(screen.getByText('アーチ眉')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '眉のメイクを見る' }));
  expect(router.push).toHaveBeenCalledWith('/parts/brow');

  const cards = await screen.findAllByRole('button', { name: /メイク、mio/ });
  expect(cards[0]).toHaveProp('accessibilityLabel', '丸顔メイク、mio、丸顔向け');
  await fireEvent.press(screen.getByRole('button', { name: '狐メイク、mio' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
});

test('says when no diagnosis was made and goes back', async () => {
  params.mockReturnValue({});
  await render(<Diagnosis />, { wrapper });
  expect(
    screen.getByText('まだ診断していません。提案のタブで写真を撮るか選んでください'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
