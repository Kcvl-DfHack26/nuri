import type { ReactNode } from 'react';

import { Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

// UIScrollView/Android ScrollView owns keyboard avoidance and native header insets.
// Empty, loading and error screens need the same inset behavior as content screens.
export function Screen({ children }: { children: ReactNode }) {
  // iOS insets for the tab bar; Android's tab bar floats over tab screens (see AppTabs).
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios' ? 0 : insets.bottom;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: 20, paddingBottom: bottom + 20, gap: 24 }}
    >
      {children}
    </ScrollView>
  );
}
