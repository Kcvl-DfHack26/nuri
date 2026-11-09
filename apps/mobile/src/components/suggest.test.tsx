import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { diagnoseFace } from '@/lib/face-diagnosis';
import { deleteFile } from '@/lib/files';
import { TestQueryProvider } from '@/lib/test/query-client';

import type { FaceTrackerViewProps } from '../../modules/face-tracker/src/FaceTracker.types';

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
jest.mock('@/lib/files', () => ({ deleteFile: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  Directory: jest.fn(() => ({ exists: false, delete: jest.fn() })),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => true,
  },
  useFocusEffect: () => {},
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#43304b' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../modules/face-tracker/src/FaceTrackerModule', () => ({
  __esModule: true,
  default: {
    detectFaceAsync: (uri: string) => mockDetect(uri),
    requestCameraPermissionAsync: () => mockRequestCamera(),
  },
}));
let mockTrackerProps: FaceTrackerViewProps | undefined;
const mockRequestCamera = jest.fn<Promise<boolean>, []>();
const mockSnapshot = jest.fn<Promise<string | null>, []>();
jest.mock('../../modules/face-tracker/src/FaceTrackerView', () => ({
  __esModule: true,
  default: (props: FaceTrackerViewProps) => {
    mockTrackerProps = props;
    jest
      .requireActual<typeof import('react')>('react')
      .useImperativeHandle(props.ref, () => ({ takeSnapshotAsync: mockSnapshot }));
    return null;
  },
}));
jest.mock('@/lib/face-diagnosis', () => ({
  ...jest.requireActual<typeof import('@/lib/face-diagnosis')>('@/lib/face-diagnosis'),
  diagnoseFace: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  authClient: { useSession: () => ({ data: mockSignedIn ? { user: { id: 'viewer' } } : null }) },
  apiUrl: 'http://localhost:8080',
  apiAssetUrl: (path: string) => path,
  api: {
    api: {
      recipes: { $get: () => mockGetRecipes() },
      me: {
        profile: {
          $get: async () => ({
            status: 200,
            json: async () => ({ profile: { faceType: mockSavedFaceType } }),
          }),
          $patch: (input: { json: { faceType?: string | null } }) => mockPatchProfile(input),
        },
      },
    },
  },
}));
let mockSignedIn = false;
let mockSavedFaceType: string | null = null;
const mockPatchProfile = jest.fn(async ({ json }: { json: { faceType?: string | null } }) => {
  mockSavedFaceType = json.faceType ?? null;
  return new Response(null);
});

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

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = false;
  mockSavedFaceType = null;
  mockTrackerProps = undefined;
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///face.jpg', width: 100, height: 100 }],
  });
});

test('diagnoses a chosen photo on device and opens the result', async () => {
  mockDetect.mockResolvedValue(landmarks);
  diagnose.mockReturnValue({
    kind: 'ok',
    faceType: 'round',
    eye: 'droopy',
    midface: 'short',
    brow: 'falling',
  });
  await render(<Suggest />);
  expect(screen.getByRole('button', { name: '前回の診断（まだありません）' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/diagnosis',
      params: {
        face: 'round',
        eye: 'droopy',
        midface: 'short',
        brow: 'falling',
        photo: 'file:///face.jpg',
      },
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

test('diagnoses a camera photo without requiring a live tracking result', async () => {
  mockRequestCamera.mockResolvedValue(true);
  mockSnapshot.mockResolvedValue('file:///frame.jpg');
  mockDetect.mockResolvedValue(landmarks);
  diagnose.mockReturnValue({
    kind: 'ok',
    faceType: 'oval',
    eye: 'standard',
    midface: 'standard',
    brow: null,
  });
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  await fireEvent.press(await screen.findByRole('button', { name: '撮影して診断' }));
  await waitFor(() => {
    expect(mockDetect).toHaveBeenCalledWith('file:///frame.jpg');
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining(landmarks));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/diagnosis',
      params: { face: 'oval', eye: 'standard', midface: 'standard', photo: 'file:///frame.jpg' },
    });
  });
  expect(deleteFile).not.toHaveBeenCalled();
});

test('deletes a camera photo that is not shown and keeps the adopted one', async () => {
  mockRequestCamera.mockResolvedValue(true);
  mockSnapshot
    .mockResolvedValueOnce('file:///kept.jpg')
    .mockResolvedValueOnce('file:///turned.jpg');
  mockDetect.mockResolvedValue(landmarks);
  diagnose.mockReturnValue({
    kind: 'ok',
    faceType: 'oval',
    eye: 'standard',
    midface: 'standard',
    brow: null,
  });
  await render(<Suggest />);
  const shoot = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
    await fireEvent.press(await screen.findByRole('button', { name: '撮影して診断' }));
  };
  await shoot();
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledTimes(1);
  });
  // A turned face is not adopted: its frame is deleted and the previous result keeps its photo.
  diagnose.mockReturnValueOnce({ kind: 'notFrontal' });
  await shoot();
  expect(await screen.findByText('正面を向いた写真で試してください')).toBeOnTheScreen();
  expect(deleteFile).toHaveBeenCalledWith('file:///turned.jpg');
  expect(deleteFile).not.toHaveBeenCalledWith('file:///kept.jpg');
  await fireEvent.press(screen.getByRole('button', { name: 'やめる' }));
  await fireEvent.press(screen.getByRole('button', { name: '前回の診断' }));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/diagnosis',
    params: { face: 'oval', eye: 'standard', midface: 'standard', photo: 'file:///kept.jpg' },
  });
  // A photo from the library replaces the result, so the camera frame is let go.
  await fireEvent.press(screen.getByRole('button', { name: '写真から診断' }));
  await waitFor(() => {
    expect(deleteFile).toHaveBeenCalledWith('file:///kept.jpg');
  });
});

test('explains when camera permission or a camera frame is unavailable', async () => {
  mockRequestCamera.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  mockSnapshot.mockResolvedValue(null);
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  expect(
    await screen.findByText('カメラを使う許可がありません。設定から許可してください'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  await fireEvent.press(await screen.findByRole('button', { name: '撮影して診断' }));
  expect(
    await screen.findByText('カメラの映像を保存できませんでした。もう一度お試しください'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'やめる' }));
  expect(screen.getByRole('button', { name: 'カメラで診断' })).toBeEnabled();
  expect(router.push).not.toHaveBeenCalled();
});

test('explains camera startup failures and permits retry without requiring a live face', async () => {
  mockRequestCamera.mockResolvedValue(true);
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  await act(() => {
    mockTrackerProps?.onStatus?.({ nativeEvent: { status: 'noFace' } });
  });
  expect(screen.getByRole('button', { name: '撮影して診断' })).toBeEnabled();
  expect(screen.queryByText('顔を枠に合わせてください')).not.toBeOnTheScreen();

  await act(() => {
    mockTrackerProps?.onStatus?.({ nativeEvent: { status: 'error' } });
  });
  expect(screen.getByText('カメラを開けませんでした。もう一度お試しください')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '撮影して診断' })).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  expect(
    screen.queryByText('カメラを開けませんでした。もう一度お試しください'),
  ).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '撮影して診断' })).toBeEnabled();

  await act(() => {
    mockTrackerProps?.onStatus?.({ nativeEvent: { status: 'permissionDenied' } });
  });
  expect(
    screen.getByText('カメラを使う許可がありません。設定から許可してください'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'カメラで診断' })).toBeEnabled();
});

test('retries a camera photo when still-image detection finds no face', async () => {
  mockRequestCamera.mockResolvedValue(true);
  mockSnapshot
    .mockResolvedValueOnce('file:///no-face.jpg')
    .mockResolvedValueOnce('file:///face.jpg');
  mockDetect.mockResolvedValueOnce(null).mockResolvedValueOnce(landmarks);
  diagnose.mockReturnValue({
    kind: 'ok',
    faceType: 'oval',
    eye: 'standard',
    midface: 'standard',
    brow: null,
  });
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  await fireEvent.press(await screen.findByRole('button', { name: '撮影して診断' }));
  expect(
    await screen.findByText('顔が見つかりませんでした。顔全体が写った写真で試してください'),
  ).toBeOnTheScreen();
  expect(deleteFile).toHaveBeenCalledWith('file:///no-face.jpg');
  await fireEvent.press(screen.getByRole('button', { name: '撮影して診断' }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});

test('shows the face type, the brows and recipes for that face type first', async () => {
  params.mockReturnValue({
    face: 'round',
    eye: 'droopy',
    midface: 'short',
    brow: 'falling',
    photo: 'file:///face.jpg',
  });
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
  expect(screen.getByRole('header', { name: '丸顔' })).toBeOnTheScreen();
  expect(screen.getByText('たれ目・中顔面短め')).toBeOnTheScreen();
  // Each result shows the definition it was given by.
  expect(screen.getByText('縦と横の長さが近く、輪郭に丸みがある')).toBeOnTheScreen();
  expect(screen.getByText('目尻が目頭より下がっている')).toBeOnTheScreen();
  expect(screen.getByText('中顔面短め（目安）')).toBeOnTheScreen();
  expect(screen.getByText('下がり眉')).toBeOnTheScreen();
  expect(screen.getByText('アーチ眉')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '眉のメイクを見る' }));
  expect(router.push).toHaveBeenCalledWith('/parts/brow');

  const cards = await screen.findAllByRole('button', { name: /メイク、mio/ });
  expect(cards[0]).toHaveProp('accessibilityLabel', '丸顔メイク、mio、丸顔向け');
  await fireEvent.press(screen.getByRole('button', { name: '狐メイク、mio' }));
  expect(router.push).toHaveBeenCalledWith('/recipes/fox');
});

test('saves the diagnosed face type to the profile, sending a guest to log in first', async () => {
  params.mockReturnValue({ face: 'round', eye: 'droopy', midface: 'short', brow: 'falling' });
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
  await fireEvent.press(screen.getByRole('button', { name: '顔タイプをプロフィールに保存' }));
  expect(router.push).toHaveBeenCalledWith('/account');
  expect(mockPatchProfile).not.toHaveBeenCalled();
});

test('saves the diagnosed face type once for a signed-in user', async () => {
  mockSignedIn = true;
  params.mockReturnValue({ face: 'round', eye: 'droopy', midface: 'short', brow: 'falling' });
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
  const save = await screen.findByRole('button', {
    name: '顔タイプをプロフィールに保存',
    disabled: false,
  });
  await fireEvent.press(save);
  expect(mockPatchProfile).toHaveBeenCalledWith({ json: { faceType: 'round' } });
  expect(
    await screen.findByRole('button', { name: 'プロフィールに保存済み', disabled: true }),
  ).toBeOnTheScreen();
});

test('fills the recommendations with up to ten recipes and opens the full list', async () => {
  params.mockReturnValue({ face: 'round', eye: 'droopy', midface: 'short', brow: 'falling' });
  // Twelve newest recipes; the last one is the only one tagged for a round face.
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `recipe-${index}`,
    title: `メイク${index}`,
    image: `/sample-recipes/${index}.jpg`,
    tags: index === 11 ? ['丸顔向け'] : [],
    likeCount: 0,
    author: { id: 'sample-mio', name: 'mio' },
  }));
  mockGetRecipes.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ items, nextOffset: null }),
  });
  await render(<Diagnosis />, { wrapper: TestQueryProvider });

  const cards = await screen.findAllByRole('button', { name: /^メイク\d+、mio/ });
  expect(cards).toHaveLength(10);
  expect(cards[0]).toHaveProp('accessibilityLabel', 'メイク11、mio、丸顔向け');
  expect(cards[1]).toHaveProp('accessibilityLabel', 'メイク0、mio');

  await fireEvent.press(screen.getByRole('button', { name: 'おすすめメイクをすべて見る' }));
  expect(router.navigate).toHaveBeenCalledWith({ pathname: '/', params: { scope: 'whole' } });
});

test('says when no diagnosis was made and goes back', async () => {
  params.mockReturnValue({});
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
  expect(
    screen.getByText('まだ診断していません。提案のタブで写真を撮るか選んでください'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
