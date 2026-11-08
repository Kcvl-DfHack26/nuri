import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { HEART, HEART_FILLED } from '@/components/favorite-icons';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import sparkleWhite from '../../assets/plan-a/icons/sparkle-white.svg';

// Plan A bottom bar shared by ③ and ⑤: favorite and the main start action.
export function StartBar({
  bottom,
  onStart,
  favorite,
}: {
  bottom: number;
  /** Without a handler the start action shows as not built yet. */
  onStart?: (() => void) | undefined;
  /** Without it the favorite button shows as not built yet. */
  favorite?: { favorited: boolean; onPress: () => void } | undefined;
}) {
  const ink = useTokenColor('--color-ink-primary');
  const rose = useTokenColor('--color-accent-rose');
  const disabled = !onStart;
  return (
    <View
      className="absolute inset-x-0 bottom-0 flex-row items-center gap-2.5 bg-tab-glass px-4 pt-3"
      style={{ paddingBottom: Math.max(bottom, 12) }}
    >
      {favorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="お気に入り"
          accessibilityState={{ selected: favorite.favorited }}
          onPress={favorite.onPress}
          className="size-13 items-center justify-center rounded-full bg-white active:opacity-70"
        >
          <SocialIcon
            name={favorite.favorited ? HEART_FILLED : HEART}
            webGlyph={favorite.favorited ? '♥' : '♡'}
            size={22}
            color={favorite.favorited ? rose : ink}
          />
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="お気に入り（準備中）"
          accessibilityState={{ disabled: true }}
          className="size-13 items-center justify-center rounded-full bg-white"
        >
          <SocialIcon name={HEART} webGlyph="♡" size={22} color={ink} />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={disabled ? 'メイクをはじめる（準備中）' : 'メイクをはじめる'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onStart}
        className={cn(
          'min-h-13 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-5 active:opacity-80',
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
