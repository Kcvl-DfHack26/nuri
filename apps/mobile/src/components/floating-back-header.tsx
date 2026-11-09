import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { View } from 'react-native';

import { GlassIconButton } from '@/components/glass-icon-button';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});

export function FloatingBackHeader({
  title,
  insetTop,
  height,
  topOffset = 0,
  onHeight,
  trailing,
}: {
  title: string;
  insetTop: number;
  height: number;
  topOffset?: number;
  onHeight: (height: number) => void;
  trailing?: ReactNode;
}) {
  return (
    <>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insetTop + height + 20,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.97) 82%, rgba(255,255,255,0) 100%)',
        }}
      />
      <View
        className="absolute inset-x-4 min-h-11 flex-row items-center gap-2"
        style={{ top: insetTop + topOffset }}
        onLayout={(event) => {
          onHeight(event.nativeEvent.layout.height);
        }}
      >
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className="border-black/8 bg-white"
          onPress={backOrHome}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-maru-bold text-heading text-ink-primary"
        >
          {title}
        </Text>
        {trailing ?? <View className="size-10" />}
      </View>
    </>
  );
}
