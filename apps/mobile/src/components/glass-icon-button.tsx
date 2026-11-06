import type { ComponentProps } from 'react';

import { Pressable } from 'react-native';

import { SocialIcon } from '@/components/social-icon';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

type IconName = ComponentProps<typeof SocialIcon>['name'];

// Plan A round translucent button over photos. The 40pt circle gets a 48pt hit area.
// Screens over a plain background pass a solid surface through className.
export function GlassIconButton({
  icon,
  label,
  onPress,
  className,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  className?: string;
}) {
  const disabled = !onPress;
  const ink = useTokenColor('--color-ink-primary');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      className={cn(
        'size-10 items-center justify-center rounded-full border border-white/90 bg-white/60 active:opacity-70',
        className,
      )}
      style={{ boxShadow: '0px 4px 8px rgba(196, 61, 112, 0.1)' }}
    >
      <SocialIcon name={icon} size={22} color={ink} />
    </Pressable>
  );
}
