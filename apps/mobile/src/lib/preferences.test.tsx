import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { Uniwind } from 'uniwind';

import { PreferencesProvider, usePreferences } from './preferences';

jest.mock('expo-sqlite/localStorage/install', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: jest.fn(), setItem: jest.fn() },
  });
  return {};
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('uniwind', () => ({ Uniwind: { setTheme: jest.fn() } }));

const readStoredPreferences = jest.spyOn(globalThis.localStorage, 'getItem');
const writeStoredPreferences = jest.spyOn(globalThis.localStorage, 'setItem');
const setTheme = jest.spyOn(Uniwind, 'setTheme');

let stored: string | null;

beforeEach(() => {
  stored = null;
  readStoredPreferences.mockImplementation(() => stored);
  writeStoredPreferences.mockImplementation((_key, value) => {
    stored = value;
  });
});

function AppearanceControls() {
  const { preferences, update, storageError } = usePreferences();
  return (
    <View>
      <Text testID="appearance">{preferences.appearance}</Text>
      {(['system', 'light', 'dark'] as const).map((appearance) => (
        <Pressable
          key={appearance}
          onPress={() => {
            update({ appearance });
          }}
        >
          <Text>{`Use ${appearance}`}</Text>
        </Pressable>
      ))}
      {storageError && <Text role="alert">{storageError}</Text>}
    </View>
  );
}

function PreferencesFixture() {
  return (
    <PreferencesProvider>
      <AppearanceControls />
    </PreferencesProvider>
  );
}

test('restores the saved theme and persists changes across a remount', async () => {
  stored = JSON.stringify({ appearance: 'dark' });
  await render(<PreferencesFixture />);
  expect(setTheme).toHaveBeenLastCalledWith('dark');
  await fireEvent.press(screen.getByText('Use light'));
  expect(setTheme).toHaveBeenLastCalledWith('light');
  await screen.unmount();
  await render(<PreferencesFixture />);
  expect(screen.getByTestId('appearance')).toHaveTextContent('light');
  expect(setTheme).toHaveBeenLastCalledWith('light');
  await fireEvent.press(screen.getByText('Use system'));
  expect(setTheme).toHaveBeenLastCalledWith('system');
});

test('falls back to the system theme when stored preferences are invalid', async () => {
  stored = '{invalid JSON';
  await render(<PreferencesFixture />);
  expect(screen.getByTestId('appearance')).toHaveTextContent('system');
  expect(setTheme).toHaveBeenLastCalledWith('system');
});

test('keeps the current theme on storage failure and allows retry', async () => {
  await render(<PreferencesFixture />);
  writeStoredPreferences.mockImplementationOnce(() => {
    throw new Error('Storage unavailable');
  });
  await fireEvent.press(screen.getByText('Use dark'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    '設定を保存できませんでした。もう一度お試しください。',
  );
  expect(setTheme).toHaveBeenLastCalledWith('system');
  expect(screen.getByTestId('appearance')).toHaveTextContent('system');
  await fireEvent.press(screen.getByText('Use dark'));
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(setTheme).toHaveBeenLastCalledWith('dark');
});
