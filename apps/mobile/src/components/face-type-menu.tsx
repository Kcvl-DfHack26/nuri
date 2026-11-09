import type { ReactElement } from 'react';

import { type MenuComponentRef, MenuView } from '@expo/ui/community/menu';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

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
  // The Compose menu sizes its trigger to its contents, so give it the card’s measured width.
  const [width, setWidth] = useState(0);
  const canOpen = !disabled && width > 0;

  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`顔タイプ ${valueLabel}`}
      accessibilityState={{ disabled: !canOpen }}
      disabled={!canOpen}
      onPress={() => {
        menu.current?.show();
      }}
      style={{ width: width || undefined }}
    >
      {children}
    </Pressable>
  );

  return (
    <View
      testID="face-type-row"
      onLayout={({ nativeEvent }) => {
        setWidth(nativeEvent.layout.width);
      }}
    >
      {canOpen ? (
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
      ) : (
        trigger
      )}
    </View>
  );
}
