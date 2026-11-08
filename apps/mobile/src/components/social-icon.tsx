import type { ComponentProps } from 'react';

import { Icon } from '@expo/ui';
import { Platform, Text } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { iconSize } from '@/theme/metrics';

// Native symbols inside custom React Native controls; the parent owns the tap target.
export function SocialIcon({
  size = iconSize,
  webGlyph,
  ...props
}: ComponentProps<typeof Icon> & { webGlyph?: string }) {
  if (Platform.OS === 'web' && webGlyph) {
    return (
      <Text aria-hidden style={{ color: props.color, fontSize: size, lineHeight: size }}>
        {webGlyph}
      </Text>
    );
  }
  return (
    <NativeHost accessible={false} pointerEvents="none" style={{ width: size, height: size }}>
      <Icon size={size} {...props} />
    </NativeHost>
  );
}
