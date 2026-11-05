import type { UniversalHostProps } from '@expo/ui';

import { Host } from '@expo/ui';
import { useColorScheme } from 'react-native';

import { colors } from '@/theme/colors';

export function NativeHost(props: UniversalHostProps) {
  const scheme = useColorScheme();
  return <Host seedColor={colors.accent} colorScheme={scheme ?? 'light'} {...props} />;
}
