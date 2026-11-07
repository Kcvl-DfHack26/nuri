import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { DeviceEventEmitter, Text } from 'react-native';

// Jest runs as iOS, so './app-tabs' would resolve to the NativeTabs file. Load the bar that
// Android draws by its full file name.
const { AppTabs } = jest.requireActual<typeof import('./app-tabs')>('./app-tabs.tsx');

jest.mock('expo-image', () => ({ Image: () => null }));

// Like the app, each tab is a group with its own layout.
const routes = {
  '(tabs)/_layout': AppTabs,
  '(tabs)/(make)/_layout': Slot,
  '(tabs)/(suggest)/_layout': Slot,
  '(tabs)/(feed)/_layout': Slot,
  '(tabs)/(profile)/_layout': Slot,
  '(tabs)/(make)/index': () => <Text>メイク画面</Text>,
  '(tabs)/(suggest)/suggest': () => <Text>提案画面</Text>,
  '(tabs)/(feed)/record': () => <Text>投稿画面</Text>,
  '(tabs)/(profile)/profile': () => <Text>マイ画面</Text>,
};

test('shows the four Plan A tabs and marks the open one selected', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  expect(screen.getByText('メイク画面')).toBeVisible();
  for (const label of ['メイク', '提案', '投稿', 'マイ']) {
    expect(screen.getByRole('tab', { name: label })).toBeVisible();
  }
  expect(screen.getByRole('tab', { name: 'メイク' })).toBeSelected();
  expect(screen.getByRole('tab', { name: '提案' })).not.toBeSelected();
});

test('switches tabs and goes back to the first tab like Android back', async () => {
  const router = await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(screen.getByRole('tab', { name: '提案' }));
  expect(screen.getByText('提案画面')).toBeVisible();
  expect(router.getPathname()).toBe('/suggest');
  expect(screen.getByRole('tab', { name: '提案' })).toBeSelected();

  await fireEvent.press(screen.getByRole('tab', { name: 'マイ' }));
  expect(screen.getByText('マイ画面')).toBeVisible();
  expect(router.getPathname()).toBe('/profile');

  await testRouter.back();
  expect(router.getPathname()).toBe('/');
  expect(screen.getByRole('tab', { name: 'メイク' })).toBeSelected();
});

test('hides the bar while the keyboard is shown', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  await act(() => {
    DeviceEventEmitter.emit('keyboardDidShow', {});
  });
  expect(
    screen.getByRole('tab', { name: 'メイク', includeHiddenElements: true }),
  ).not.toBeVisible();
  await act(() => {
    DeviceEventEmitter.emit('keyboardDidHide', {});
  });
  expect(screen.getByRole('tab', { name: 'メイク' })).toBeVisible();
});
