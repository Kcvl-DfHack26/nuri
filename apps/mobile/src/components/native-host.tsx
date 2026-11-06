import type { UniversalHostProps } from '@expo/ui';

import { Host } from '@expo/ui';
import { useColorScheme } from 'react-native';

export function NativeHost(props: UniversalHostProps) {
  const scheme = useColorScheme();
  return <Host colorScheme={scheme ?? 'light'} {...props} />;
}
