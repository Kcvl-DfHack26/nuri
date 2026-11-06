import type { ReactNode } from 'react';

import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

// UIScrollView/Android ScrollView owns keyboard avoidance and native header insets.
// Empty, loading and error screens need the same inset behavior as content screens.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: 20, gap: 24 }}
    >
      {children}
    </ScrollView>
  );
}
