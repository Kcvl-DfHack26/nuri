import { Host, Menu, Picker, RNHostView, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  accessibilityValue,
  disabled,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import type { FaceTypeMenuProps } from './face-type-menu';

export function FaceTypeMenu({
  value,
  valueLabel,
  options,
  onSelect,
  disabled: isDisabled,
  children,
}: FaceTypeMenuProps) {
  return (
    <Host colorScheme="light" matchContents={{ vertical: true }}>
      <Menu
        label={
          <RNHostView matchContents={{ vertical: true }} boundedByHost>
            {children}
          </RNHostView>
        }
        modifiers={[
          accessibilityLabel('顔タイプ'),
          accessibilityValue(valueLabel),
          disabled(isDisabled),
        ]}
      >
        <Picker selection={value} onSelectionChange={onSelect} modifiers={[pickerStyle('inline')]}>
          {options.map(({ id, title }) => (
            <Text key={id} modifiers={[tag(id)]}>
              {title}
            </Text>
          ))}
        </Picker>
      </Menu>
    </Host>
  );
}
