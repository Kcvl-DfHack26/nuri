import { Icon } from '@expo/ui';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});

const stages = [
  '動画を読み込む',
  '手順の区切りを確認する',
  '使ったコスメを探す',
  '塗った範囲を読み取る',
  '説明文を作る',
];
const tick = { ms: 150, percent: 4 };

// Plan A ⑫-3 手順書を作成中. Nothing is analyzed yet: the progress only paces the move to
// Plan A's sample steps on ⑫-4.
export function PostCreating() {
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((current) => Math.min(current + tick.percent, 100));
    }, tick.ms);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (progress >= 100) {
      router.replace('/post/review');
    }
  }, [progress]);
  const done = Math.floor((progress / 100) * stages.length);
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.camera}>
        <View className="absolute inset-0 bg-white/25" />
      </FaceScene>
      {/* Plan A has no close here; leaving stops the sample, as there is no job to continue. */}
      <View className="absolute left-4" style={{ top: insets.top + 8 }}>
        <GlassIconButton
          icon={CLOSE}
          label="閉じる"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
      <View
        className="absolute inset-x-0 bottom-0 gap-4 rounded-t-[28px] bg-[rgba(241,241,241,0.85)] px-5 pt-[22px]"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 6 }}
      >
        <View className="flex-row items-center gap-2">
          <Text
            accessibilityRole="header"
            className="flex-1 font-maru-bold text-headline text-ink-primary"
          >
            手順書を作っています
          </Text>
          <Text className="font-maru-bold text-headline text-accent-rose">{progress}%</Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="手順書の作成"
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          className="h-2.5 overflow-hidden rounded-[5px] bg-ink-primary/15"
        >
          <View className="h-full rounded-[5px] bg-accent-rose" style={{ width: `${progress}%` }} />
        </View>
        <View className="gap-2.5">
          {stages.map((stage, index) => (
            <Stage key={stage} label={stage} state={stageState(index, done)} />
          ))}
        </View>
        <Text className="font-maru text-meta text-ink-secondary">
          見本の手順書を作っています。閉じると作成をやめます
        </Text>
      </View>
    </View>
  );
}

type StageState = 'done' | 'current' | 'todo';

function stageState(index: number, done: number): StageState {
  if (index < done) {
    return 'done';
  }
  return index === done ? 'current' : 'todo';
}

function Stage({ label, state }: { label: string; state: StageState }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}、${{ done: '完了', current: '処理中', todo: '待機中' }[state]}`}
      className="flex-row items-center gap-2.5"
    >
      {state === 'done' ? (
        <View className="size-[22px] items-center justify-center rounded-full bg-accent-rose">
          <SocialIcon name={CHECK} size={14} color="white" />
        </View>
      ) : (
        <View
          className={cn(
            'size-[22px] rounded-full border-2',
            state === 'current' ? 'border-accent-rose' : 'border-ink-primary/30',
          )}
        />
      )}
      <Text
        className={cn(
          'flex-1',
          state === 'todo'
            ? 'font-maru text-ui text-ink-secondary'
            : 'font-maru-bold text-label text-ink-primary',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
