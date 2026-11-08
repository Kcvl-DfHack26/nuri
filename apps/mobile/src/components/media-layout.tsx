import type { ReactNode } from 'react';

import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasRoomForSidePanel, useLayoutSize } from '@/lib/layout';
import { cn } from '@/lib/utils';

/** Plan A overlays the controls on the media. A wide, short view has room for both panes. */
export function MediaLayout({
  media,
  header,
  footer,
}: {
  media: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width, height, onLayout } = useLayoutSize();
  const availableWidth = width - insets.left - insets.right;
  const wide = hasRoomForSidePanel(availableWidth, height);
  const controlsWidth = availableWidth * 0.42;

  return (
    <View
      className="flex-1 bg-white"
      onLayout={onLayout}
      style={{ paddingLeft: insets.left, paddingRight: insets.right }}
    >
      <StatusBar style="dark" />
      <View
        className="absolute inset-y-0 items-center overflow-hidden bg-bg-surface"
        style={{
          left: insets.left,
          right: insets.right + (wide ? controlsWidth : 0),
        }}
      >
        <View
          className="w-full flex-1 overflow-hidden"
          style={wide ? { maxWidth: height * 0.8 } : undefined}
        >
          {media}
        </View>
      </View>
      <View
        pointerEvents="box-none"
        className={cn('justify-between', wide ? 'absolute inset-y-0 bg-bg-surface' : 'flex-1')}
        style={wide ? { width: controlsWidth, right: insets.right } : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          pointerEvents="box-none"
          style={{ flexGrow: 0, flexShrink: 1 }}
        >
          {header}
        </ScrollView>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          pointerEvents="box-none"
          style={{ flexGrow: 0, flexShrink: 1 }}
        >
          {footer}
        </ScrollView>
      </View>
    </View>
  );
}
