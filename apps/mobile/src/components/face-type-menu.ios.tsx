import { Host, Menu, Picker, Rectangle, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  accessibilityValue,
  contentShape,
  disabled,
  foregroundStyle,
  pickerStyle,
  shapes,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import type { FaceTypeMenuProps } from './face-type-menu';

export function FaceTypeMenu({
  value,
  valueLabel,
  options,
  onSelect,
  disabled: isDisabled,
  children,
}: FaceTypeMenuProps) {
  const trigger = (
    <Rectangle modifiers={[foregroundStyle('transparent'), contentShape(shapes.rectangle())]} />
  );
  return (
    <View>
      {children}
      <Host colorScheme="light" ignoreSafeArea="all" style={StyleSheet.absoluteFill}>
        <Menu
          label={trigger}
          modifiers={[
            accessibilityLabel('顔タイプ'),
            accessibilityValue(valueLabel),
            disabled(isDisabled),
          ]}
        >
          <Picker
            selection={value}
            onSelectionChange={onSelect}
            modifiers={[pickerStyle('inline')]}
          >
            {options.map(({ id, title }) => (
              <Text key={id} modifiers={[tag(id)]}>
                {title}
              </Text>
            ))}
          </Picker>
        </Menu>
      </Host>
    </View>
  );
}
