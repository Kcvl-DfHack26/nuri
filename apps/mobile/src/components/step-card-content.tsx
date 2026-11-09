import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { View } from 'react-native';

import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { useTokenColor } from '@/theme/tokens';

const PLAY = Icon.select({
  ios: 'play.fill',
  android: import('@expo/material-symbols/play_arrow.xml'),
});

export function StepCardContent({
  number,
  title,
  summary,
  length,
  children,
}: {
  number: number;
  title: string;
  summary: string;
  length: string;
  children: ReactNode;
}) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <>
      <View className="h-21 w-17 overflow-hidden rounded-thumbnail">
        {children}
        <View className="absolute left-1.25 top-1.25 size-5.5 items-center justify-center rounded-full bg-accent-rose">
          <Text className="font-maru-bold text-micro text-bg-surface">{number}</Text>
        </View>
        <View className="absolute bottom-1.25 right-1.25 size-6 items-center justify-center rounded-full bg-bg-surface">
          <SocialIcon name={PLAY} size={14} color={ink} />
        </View>
      </View>
      <View className="flex-1 gap-0.75">
        <Text className="font-maru-bold text-action text-ink-primary">{title}</Text>
        {summary ? <Text className="font-maru text-meta text-ink-secondary">{summary}</Text> : null}
        <Text className="font-maru text-meta text-accent-rose">区間 {length}</Text>
      </View>
    </>
  );
}
