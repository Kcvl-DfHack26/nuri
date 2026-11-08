import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PostStep } from '@/components/post-draft';

import { GlassIconButton } from '@/components/glass-icon-button';
import { parts } from '@/components/recipes';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});

// Shared parts of the Plan A ⑫ 投稿 screens.

/** ⑫-4/⑫-5/⑫-7 header: back on the left and the screen title centered. */
export function PostHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-2 bg-white px-4 pb-2"
      style={{ paddingTop: insets.top + 6 }}
    >
      <GlassIconButton
        icon={BACK}
        label="戻る"
        onPress={() => {
          backOrHome();
        }}
      />
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-maru-bold text-heading text-ink-primary"
      >
        {title}
      </Text>
      <View className="w-10" />
    </View>
  );
}

/** Plan A's rose call to action. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  /** Without a handler the action shows as not built yet. */
  onPress?: () => void;
  icon?: ReactNode;
  /** A built action that cannot run right now, e.g. nothing to save. */
  disabled?: boolean;
}) {
  const unbuilt = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unbuilt ? `${label}（準備中）` : label}
      accessibilityState={{ disabled: unbuilt || disabled }}
      disabled={unbuilt || disabled}
      onPress={onPress}
      className={cn(
        'min-h-13 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-4.5 active:opacity-80',
        disabled && 'opacity-50',
      )}
      style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
    >
      {icon}
      <Text className="font-maru-bold text-action text-white">{label}</Text>
    </Pressable>
  );
}

/** Translucent bar that holds the screen's main action above the home indicator. */
export function BottomCta({
  children,
  rounded = true,
}: {
  children: ReactNode;
  rounded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn('bg-post-panel px-4 pt-3', rounded && 'rounded-t-sheet')}
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {children}
    </View>
  );
}

/** Dashed outline action, e.g. 手順を追加 and コスメを追加. */
export function DashedButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}（準備中）` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-12 flex-row items-center justify-center gap-1.5 rounded-3xl border border-dashed border-ink-primary px-4 active:opacity-70"
    >
      {icon}
      <Text className="font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}

/** ⑫-4/⑫-5: the step's frame from the video, or its part's icon when no frame could be cut. */
export function StepFrame({ step }: { step: Pick<PostStep, 'part' | 'image'> }) {
  if (step.image) {
    return (
      <Image
        accessible={false}
        source={{ uri: step.image }}
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
  const part = parts[step.part];
  return (
    <View className={cn('flex-1 items-center justify-center', part.iconBackground)}>
      <Image accessible={false} source={part.icon} style={{ width: 28, height: 28 }} />
    </View>
  );
}
