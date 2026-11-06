import type { ComponentProps } from 'react';

import { Icon } from '@expo/ui';

import { NativeHost } from '@/components/native-host';
import { iconSize } from '@/theme/metrics';

// Native symbols inside custom React Native controls; the parent owns the tap target.
export function SocialIcon({ size = iconSize, ...props }: ComponentProps<typeof Icon>) {
  return (
    <NativeHost accessible={false} pointerEvents="none" style={{ width: size, height: size }}>
      <Icon size={size} {...props} />
    </NativeHost>
  );
}
