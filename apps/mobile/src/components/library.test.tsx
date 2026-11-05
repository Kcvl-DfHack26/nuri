import { fireEvent, render, screen } from '@testing-library/react-native';

import { Library } from './library';

jest.mock('@/theme/colors', () => ({
  colors: { background: '#fff', card: '#fff', text: '#000', secondary: '#555', accent: '#31745c' },
}));
jest.mock('@/components/native-host', () => ({
  NativeHost: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/preferences', () => ({
  usePreferences: () => ({ preferences: { favorites: ['read'] } }),
}));
jest.mock('@expo/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  function Item({
    label,
    value,
    onSelect,
  }: {
    label: string;
    value: string;
    onSelect?: (value: string) => void;
  }) {
    return (
      <RN.Pressable onPress={() => onSelect?.(value)}>
        <RN.Text>{label}</RN.Text>
      </RN.Pressable>
    );
  }
  function Picker({
    children,
    onValueChange,
  }: {
    children: React.ReactElement<React.ComponentProps<typeof Item>>[];
    onValueChange: (value: string) => void;
  }) {
    return (
      <RN.View>
        {React.Children.map(children, (child) =>
          React.cloneElement(child, { onSelect: onValueChange }),
        )}
      </RN.View>
    );
  }
  Picker.Item = Item;
  return { TextInput: RN.TextInput, Picker };
});

test('searches the catalog, presents empty results, and recovers when cleared', async () => {
  await render(<Library />);
  await fireEvent.changeText(screen.getByLabelText('Search rituals'), 'chapter');
  expect(screen.getByText('One more chapter')).toBeOnTheScreen();
  expect(screen.queryByText('Take the scenic route')).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Search rituals'), 'no matching ritual');
  expect(screen.getByText('Nothing here yet')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Search rituals'), '');
  expect(screen.getByText('A slower morning')).toBeOnTheScreen();
});

test('shows only saved rituals when the native picker changes', async () => {
  await render(<Library />);
  await fireEvent.press(screen.getByText('Saved rituals'));
  expect(screen.getByText('One more chapter')).toBeOnTheScreen();
  expect(screen.queryByText('A slower morning')).not.toBeOnTheScreen();
});
