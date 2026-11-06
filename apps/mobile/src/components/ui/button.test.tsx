import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as NativeText } from 'react-native';

import { Button } from './button';
import { Text } from './text';

test('activates an accessible custom button and prevents activation when disabled', async () => {
  const onPress = jest.fn();
  await render(
    <Button onPress={onPress}>
      <Text>Save changes</Text>
    </Button>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  expect(onPress).toHaveBeenCalledTimes(1);

  await screen.rerender(
    <Button disabled onPress={onPress}>
      <Text>Save changes</Text>
    </Button>,
  );
  const button = screen.getByRole('button', { name: 'Save changes' });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('preserves heading semantics, accessible labels and scalable native text', async () => {
  await render(
    <Text variant="h2" accessibilityLabel="Custom section" allowFontScaling>
      A heading
    </Text>,
  );
  const heading = screen.getByRole('heading', { name: 'Custom section' });
  expect(heading).toHaveProp('aria-level', '2');
  expect(heading).toHaveProp('allowFontScaling', true);
});

test('composes Text with a native child through the official Slot', async () => {
  await render(
    <Text asChild variant="h3">
      <NativeText accessibilityLabel="Composed heading">Details</NativeText>
    </Text>,
  );
  expect(screen.getByRole('heading', { name: 'Composed heading' })).toHaveTextContent('Details');
});
