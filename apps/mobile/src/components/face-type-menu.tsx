import type { ReactElement } from 'react';

import { type MenuComponentRef, MenuView } from '@expo/ui/community/menu';
import { useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export type FaceTypeMenuProps = {
  value: string;
  valueLabel: string;
  options: { id: string; title: string }[];
  onSelect: (id: string) => void;
  disabled: boolean;
  children: ReactElement;
};

export function FaceTypeMenu({
  value,
  valueLabel,
  options,
  onSelect,
  disabled,
  children,
}: FaceTypeMenuProps) {
  const menu = useRef<MenuComponentRef>(null);

  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`顔タイプ ${valueLabel}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        menu.current?.show();
      }}
      style={styles.trigger}
    >
      {children}
    </Pressable>
  );

  if (disabled) {
    return trigger;
  }

  return (
    <MenuView
      ref={menu}
      colorScheme="light"
      actions={options.map((option) => ({
        ...option,
        state: option.id === value ? 'on' : 'off',
      }))}
      onPressAction={({ nativeEvent }) => {
        onSelect(nativeEvent.event);
      }}
    >
      {trigger}
    </MenuView>
  );
}

const styles = StyleSheet.create({
  trigger: { width: '100%' },
});
