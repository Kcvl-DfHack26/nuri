import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { useFollow } from '@/components/use-follow';
import { cn } from '@/lib/utils';

/**
 * Plan A's follow pill for ⑤'s author and other profiles. Nothing shows for the viewer themselves
 * or until the user's profile has loaded.
 */
export function FollowButton({ user }: { user: { id: string; following: boolean } | undefined }) {
  const follow = useFollow(user);
  if (!follow) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="フォロー"
      accessibilityState={{ selected: follow.following }}
      // The 32pt pill keeps Plan A's look; hitSlop extends the target to 48pt.
      hitSlop={8}
      onPress={follow.onPress}
      className={cn(
        'min-h-8 justify-center rounded-full border border-accent-rose px-4 active:opacity-70',
        follow.following ? 'bg-accent-rose' : 'bg-white',
      )}
    >
      <Text
        className={cn(
          'font-maru-bold text-label',
          follow.following ? 'text-white' : 'text-accent-rose',
        )}
      >
        {follow.following ? 'フォロー中' : 'フォロー'}
      </Text>
    </Pressable>
  );
}
