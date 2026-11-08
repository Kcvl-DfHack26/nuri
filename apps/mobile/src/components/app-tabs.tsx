import { Image } from 'expo-image';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import makeInk from '../../assets/plan-a/icons/tab-make-ink.svg';
import makeRose from '../../assets/plan-a/icons/tab-make-rose.svg';
import meInk from '../../assets/plan-a/icons/tab-me-ink.svg';
import meRose from '../../assets/plan-a/icons/tab-me-rose.svg';
import postInk from '../../assets/plan-a/icons/tab-post-ink.svg';
import postRose from '../../assets/plan-a/icons/tab-post-rose.svg';
import suggestInk from '../../assets/plan-a/icons/tab-suggest-ink.svg';
import suggestRose from '../../assets/plan-a/icons/tab-suggest-rose.svg';

// Plan A TabBar/Glass: 16pt above the 58pt tabs, 18pt below them for the gesture handle.
const BAR_TOP = 16;
const TAB_HEIGHT = 58;
const BAR_BOTTOM = 18;

// Plan A's translucent bar with rounded top corners floats over the tab's content. Android's
// NativeTabs draws Material's opaque full-width bar with a pill and cannot round, shrink or show
// content through it, so Android and web draw this bar instead. React Native has no background
// blur, so the bar keeps Plan A's 85% opaque fill without its 15pt blur.
export function AppTabs() {
  const insets = useSafeAreaInsets();
  // Taller system navigation (three buttons) pushes the tabs up instead of covering them.
  const paddingBottom = Math.max(insets.bottom, BAR_BOTTOM);
  const [barHeight, setBarHeight] = useState(BAR_TOP + TAB_HEIGHT + paddingBottom);
  // The window resizes for the keyboard, which would lift this bar over the field being typed in.
  // Material's bar stays under the keyboard, so this bar hides while the keyboard is shown.
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardShown(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardShown(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <Tabs options={{ backBehavior: 'initialRoute' }}>
      {/* Like iOS tabs, tab screens get the area under the bar as their bottom inset. */}
      <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: barHeight }}>
        <TabSlot />
      </SafeAreaInsetsContext.Provider>
      <TabList asChild>
        <View
          accessibilityRole="tablist"
          className="absolute inset-x-0 bottom-0 gap-1.5 rounded-t-sheet bg-tab-glass"
          // TabList sets space-between through style, which wins over className.
          style={{
            display: keyboardShown ? 'none' : 'flex',
            justifyContent: 'center',
            paddingTop: BAR_TOP,
            paddingBottom,
          }}
          onLayout={(event) => {
            setBarHeight(event.nativeEvent.layout.height);
          }}
        >
          <TabTrigger name="(make)" href="/" asChild>
            <TabButton label="メイク" icon={makeInk} selectedIcon={makeRose} size={30} />
          </TabTrigger>
          <TabTrigger name="(suggest)" href="/suggest" asChild>
            <TabButton label="提案" icon={suggestInk} selectedIcon={suggestRose} size={30} />
          </TabTrigger>
          <TabTrigger name="(feed)" href="/record" asChild>
            <TabButton label="投稿" icon={postInk} selectedIcon={postRose} size={24} />
          </TabTrigger>
          <TabTrigger name="(profile)" href="/profile" asChild>
            <TabButton label="マイ" icon={meInk} selectedIcon={meRose} size={24} />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  label,
  icon,
  selectedIcon,
  size,
  isFocused = false,
  ...props
}: Omit<TabTriggerSlotProps, 'ref'> & {
  label: string;
  icon: number;
  selectedIcon: number;
  size: number;
}) {
  // Plan A enlarges the selected icon by 10% and colors it and its larger label rose.
  const iconSize = isFocused ? size * 1.1 : size;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      // Plan A gives each tab 76pt; narrow windows shrink the tabs instead of pushing them off screen.
      className="min-h-14.5 min-w-12 max-w-19 flex-1 active:opacity-70"
    >
      {/* TabTrigger lays its child out as a row, so the icon and label stack in this view. */}
      <View className="flex-1 items-center justify-center gap-0.5">
        <View className="size-7.5 items-center justify-center">
          <Image
            accessible={false}
            source={isFocused ? selectedIcon : icon}
            style={{ width: iconSize, height: iconSize }}
          />
        </View>
        <Text
          className={cn(
            'text-center font-maru-bold',
            isFocused ? 'text-meta text-accent-rose' : 'text-micro text-ink-primary',
          )}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
