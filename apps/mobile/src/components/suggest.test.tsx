import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { diagnoseFace } from '@/lib/face-diagnosis';
import { TestQueryProvider } from '@/lib/test/query-client';

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
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
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
type TrackerProps = {
  ref?: React.Ref<unknown>;
  onLandmarks?: (event: { nativeEvent: typeof landmarks & { latencyMs: number } }) => void;
  onStatus?: (event: { nativeEvent: { status: string } }) => void;
};
const mockTracker: { props: TrackerProps | null } = { props: null };
const mockRequestCamera = jest.fn<Promise<boolean>, []>();
const mockSnapshot = jest.fn<Promise<(typeof landmarks & { uri: string }) | null>, []>();
// Lets the test send frames and statuses like the native view.
jest.mock('../../modules/face-tracker/src/FaceTrackerView', () => ({
  __esModule: true,
  default: (props: TrackerProps) => {
    mockTracker.props = props;
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

test('diagnoses the saved camera frame with its own landmarks and shows it on the result', async () => {
  const saved = { points: [0.4, 0.6], width: 90, height: 160 };
  mockRequestCamera.mockResolvedValue(true);
  mockSnapshot.mockResolvedValue({ ...saved, uri: 'file:///frame.jpg' });
  diagnose.mockReturnValue({ kind: 'ok', faceType: 'oval', brow: null });
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  // The shutter waits for a face.
  expect(await screen.findByRole('button', { name: '撮影して診断' })).toBeDisabled();
  await act(async () => {
    mockTracker.props?.onLandmarks?.({ nativeEvent: { ...landmarks, latencyMs: 30 } });
    await Promise.resolve();
  });
  await fireEvent.press(screen.getByRole('button', { name: '撮影して診断' }));
  // The landmarks of the saved frame, not the last ones the screen received.
  await waitFor(() => {
    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining(saved));
  });
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/diagnosis',
      params: { face: 'oval', photo: 'file:///frame.jpg' },
    });
  });
  expect(mockDetect).not.toHaveBeenCalled();
});

test('explains when the camera is not allowed or the face is lost, and closes the camera', async () => {
  mockRequestCamera.mockResolvedValueOnce(false);
  await render(<Suggest />);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  expect(
    await screen.findByText('カメラを使う許可がありません。設定から許可してください'),
  ).toBeOnTheScreen();

  mockRequestCamera.mockResolvedValueOnce(true);
  await fireEvent.press(screen.getByRole('button', { name: 'カメラで診断' }));
  await act(async () => {
    mockTracker.props?.onLandmarks?.({ nativeEvent: { ...landmarks, latencyMs: 30 } });
    mockTracker.props?.onStatus?.({ nativeEvent: { status: 'noFace' } });
    await Promise.resolve();
  });
  expect(await screen.findByText('顔を枠に合わせてください')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '撮影して診断' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'やめる' }));
  expect(screen.getByRole('button', { name: 'カメラで診断' })).toBeEnabled();
  expect(router.push).not.toHaveBeenCalled();
});

test('shows the face type, the brows and recipes for that face type first', async () => {
  params.mockReturnValue({ face: 'round', brow: 'falling', photo: 'file:///face.jpg' });
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
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
  await render(<Diagnosis />, { wrapper: TestQueryProvider });
  expect(
    screen.getByText('まだ診断していません。提案のタブで写真を撮るか選んでください'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '戻る' }));
  expect(router.back).toHaveBeenCalled();
});
