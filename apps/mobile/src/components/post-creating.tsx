import { Icon } from '@expo/ui';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { usePostDraft } from '@/components/post-draft';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { planSteps } from '@/lib/post-steps';
import { cn } from '@/lib/utils';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});

const stages = ['動画を読み込む', '手順の区切りを確認する', '手順の場面を切り出す'];

// Plan A ⑫-3 手順書を作成中. The draft's steps are made from the video's marks, each with the frame
// at its start; the user picks each step's part and texts on ⑫-5. Plan A's stages for finding
// cosmetics, areas and descriptions are left out until something analyzes the video.
export function PostCreating() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft, trackFile } = usePostDraft();
  const video = draft.video;
  const plan = useMemo(() => (video ? planSteps(video.marks, video.durationMs) : []), [video]);
  const [cut, setCut] = useState(0);
  useEffect(() => {
    if (!video) {
      return;
    }
    let active = true;
    const cutFrames = async () => {
      const images: (string | null)[] = [];
      for (const step of plan) {
        // A frame that cannot be cut leaves the step without a photo instead of stopping the post.
        const image = await getThumbnailAsync(video.uri, { time: step.startMs, quality: 0.5 }).then(
          ({ uri }) => {
            trackFile(uri);
            return uri;
          },
          () => null,
        );
        if (!active) {
          return;
        }
        images.push(image);
        setCut(images.length);
      }
      setDraft((current) => ({
        ...current,
        steps: plan.map((step, index) => ({
          part: step.part,
          title: '',
          description: '',
          cosmetics: [],
          segment: { startMs: step.startMs, endMs: step.endMs },
          image: images[index] ?? null,
        })),
      }));
      router.replace('/post/review');
    };
    void cutFrames();
    return () => {
      active = false;
    };
  }, [video, plan, setDraft, trackFile]);
  if (!video) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text className="text-center font-maru-bold text-heading text-ink-primary">
          動画がありません
        </Text>
        <Text className="text-center font-maru text-ui text-ink-secondary">
          撮影するか、動画を選んでからお試しください
        </Text>
        <GlassIconButton
          icon={CLOSE}
          label="閉じる"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
    );
  }
  const progress = plan.length > 0 ? Math.round((cut / plan.length) * 100) : 0;
  // Loading the video and splitting it at the marks are done once the frames are being cut.
  const done = cut === plan.length ? stages.length : stages.length - 1;
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.camera}>
        <View className="absolute inset-0 bg-white/25" />
      </FaceScene>
      {/* Plan A has no close here; leaving stops making the steps and discards the draft. */}
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
          区切りごとに{plan.length}つの手順を作ります。閉じると作成をやめます
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
