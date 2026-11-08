import { Pressable } from 'react-native';

import { HEART, HEART_FILLED } from '@/components/favorite-icons';
import { SocialIcon } from '@/components/social-icon';
import { useFavorite } from '@/components/use-favorite';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

/**
 * The heart on a recipe card's photo (①, ⑭). Place it beside the card's own button, not inside
 * it, so screen readers reach both. `className` sizes and places the circle; the touch area grows
 * to 48pt/dp around it.
 */
export function CardFavorite({
  recipe,
  title,
  iconSize,
  className,
}: {
  recipe: { id: string; favorited: boolean };
  title: string;
  iconSize: number;
  className: string;
}) {
  const ink = useTokenColor('--color-ink-primary');
  const rose = useTokenColor('--color-accent-rose');
  const favorite = useFavorite(recipe);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}をお気に入り`}
      accessibilityState={{ selected: favorite.favorited }}
      hitSlop={10}
      onPress={favorite.onPress}
      className={cn(
        'absolute items-center justify-center rounded-full active:opacity-70',
        className,
      )}
    >
      <SocialIcon
        name={favorite.favorited ? HEART_FILLED : HEART}
        webGlyph={favorite.favorited ? '♥' : '♡'}
        size={iconSize}
        color={favorite.favorited ? rose : ink}
      />
    </Pressable>
  );
}
