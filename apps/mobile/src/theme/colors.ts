import { Color } from 'expo-router';
import { Platform } from 'react-native';

export const colors = {
  background: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: '#f4f5f7',
  }),
  card: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainerLow,
    default: '#ffffff',
  }),
  text: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: '#1c1c1e',
  }),
  secondary: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: '#636366',
  }),
  destructive: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: '#b3261e',
  }),
};
