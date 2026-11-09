import type { ReactElement } from 'react';

import { type MenuComponentRef, MenuView } from '@expo/ui/community/menu';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

type MenuOption = { id: string; title: string };

export type FaceTypeMenuProps = {
  label: string;
  selection: MenuOption;
  options: readonly MenuOption[];
  onSelect: (id: string) => void;
  disabled: boolean;
  children: ReactElement;
};

export function FaceTypeMenu({
  label,
  selection,
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
      accessibilityLabel={`${label} ${selection.title}`}
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
          actions={options.map(({ id, title }) => ({
            id,
            title,
            state: id === selection.id ? 'on' : 'off',
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
