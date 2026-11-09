import { Icon } from '@expo/ui';
import { recipeStepsMax } from '@starter/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { PostStep } from '@/components/post-draft';

import { AddStepPanel } from '@/components/post-add-step';
import {
  BottomCta,
  DashedButton,
  PostHeader,
  PrimaryButton,
  StepFrame,
} from '@/components/post-chrome';
import { segmentLength, stepTitle, usePostDraft } from '@/components/post-draft';
import { SocialIcon } from '@/components/social-icon';
import { StepCardContent } from '@/components/step-card-content';
import { Text } from '@/components/ui/text';
import { useTokenColor } from '@/theme/tokens';

import sparkleRose from '../../assets/plan-a/post/sparkle-rose.svg';

const MORE = Icon.select({
  ios: 'ellipsis',
  android: import('@expo/material-symbols/more_horiz.xml'),
});
const ADD = Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') });

// Plan A ⑫-4 手順書を確認. 手順を追加 opens a panel to pick the moment of the new step (#186).
export function PostReview() {
  const { draft } = usePostDraft();
  const [adding, setAdding] = useState(false);
  const canAdd = Boolean(draft.video?.durationMs) && draft.steps.length < recipeStepsMax && !adding;
  const ink = useTokenColor('--color-ink-primary');
  const pink = useTokenColor('--color-pastel-pink');
  const peach = useTokenColor('--color-pastel-peach');
  const addIcon = <SocialIcon name={ADD} size={20} color={ink} />;
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <PostHeader title="手順書を確認" />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="gap-2.5 px-4 pb-6 pt-3"
      >
        <View
          className="flex-row items-center gap-3 rounded-panel p-3.5"
          style={{ backgroundImage: `linear-gradient(to right, ${pink}, ${peach})` }}
        >
          <View className="size-10 items-center justify-center rounded-full bg-bg-surface">
            <Image accessible={false} source={sparkleRose} style={{ width: 22, height: 22 }} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-maru-bold text-label text-ink-primary">
              動画から{draft.steps.length}つの手順を作りました
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">
              タップして、文章やコスメを直せます
            </Text>
          </View>
        </View>
        {draft.steps.map((step, index) => (
          // A post may work on the same part twice, so the position is the key.
          <StepCard key={index} step={step} index={index} />
        ))}
        {adding ? (
          <AddStepPanel
            onClose={() => {
              setAdding(false);
            }}
          />
        ) : (
          <DashedButton
            label="手順を追加"
            icon={addIcon}
            {...(canAdd
              ? {
                  onPress: () => {
                    setAdding(true);
                  },
                }
              : {})}
          />
        )}
      </ScrollView>
      <BottomCta>
        <PrimaryButton
          label="メッセージを書く"
          onPress={() => {
            router.push('/post/message');
          }}
        />
      </BottomCta>
    </View>
  );
}

function StepCard({ step, index }: { step: PostStep; index: number }) {
  const ink = useTokenColor('--color-ink-primary');
  const title = stepTitle(step);
  // Plan A names the cosmetic once one is chosen, and the step's note otherwise.
  const summary = step.cosmetics[0]?.name ?? step.description;
  const length = segmentLength(step);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`手順${index + 1} ${title}、${summary}、区間 ${length}`}
      accessibilityHint="手順を編集します"
      onPress={() => {
        router.push(`/post/step/${index}`);
      }}
      className="flex-row items-center gap-3 rounded-card border-fine border-line-soft bg-bg-surface py-2.5 pl-2.5 pr-2 active:opacity-70"
    >
      <StepCardContent number={index + 1} title={title} summary={summary} length={length}>
        <StepFrame step={step} />
      </StepCardContent>
      <SocialIcon name={MORE} size={22} color={ink} />
    </Pressable>
  );
}
