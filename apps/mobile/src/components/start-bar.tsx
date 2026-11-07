import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import sparkleWhite from '../../assets/plan-a/icons/sparkle-white.svg';

const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

// Plan A bottom bar shared by ③ and ⑤: favorite (not built yet) and the main start action.
export function StartBar({
  bottom,
  onStart,
}: {
  bottom: number;
  /** Without a handler the start action shows as not built yet. */
  onStart?: (() => void) | undefined;
}) {
  const ink = useTokenColor('--color-ink-primary');
  const disabled = !onStart;
  return (
    <View
      className="absolute inset-x-0 bottom-0 flex-row items-center gap-2.5 bg-[rgba(242,242,242,0.85)] px-4 pt-3"
      style={{ paddingBottom: Math.max(bottom, 12) }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="お気に入り（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-[52px] items-center justify-center rounded-full bg-white"
      >
        <SocialIcon name={HEART} size={22} color={ink} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={disabled ? 'メイクをはじめる（準備中）' : 'メイクをはじめる'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onStart}
        className={cn(
          'min-h-[52px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-5 active:opacity-80',
          disabled && 'opacity-50',
        )}
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        <Image accessible={false} source={sparkleWhite} style={{ width: 20, height: 20 }} />
        <Text className="font-maru-bold text-action text-white">メイクをはじめる</Text>
      </Pressable>
    </View>
  );
}
