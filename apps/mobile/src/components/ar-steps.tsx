import { Icon } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RecipeStep } from '@/lib/recipes';

import { canTrackFace, FaceMakeupCamera } from '@/components/face-makeup-camera';
import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { MediaLayout } from '@/components/media-layout';
import { RecipeStatus } from '@/components/recipe-detail';
import { arOverlays, arPhotos, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { useStepCamera } from '@/components/use-step-camera';
import { apiUrl } from '@/lib/api';
import { colorName } from '@/lib/color';
import { paintColor, recipeLayers } from '@/lib/face-makeup';
import { backOrHome } from '@/lib/navigation';
import { recipeOptions } from '@/lib/recipes';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const EYE = Icon.select({ ios: 'eye', android: import('@expo/material-symbols/visibility.xml') });
const EYE_OFF = Icon.select({
  ios: 'eye.slash',
  android: import('@expo/material-symbols/visibility_off.xml'),
});
const MIC = Icon.select({ ios: 'mic', android: import('@expo/material-symbols/mic.xml') });
const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});

// Plan A ⑦ AR手順, walking through the recipe's steps from the API. The current step's area is painted
// on the tracked face with its recommended color, and its pin and label follow the face.
export function ArSteps({ id }: { id: string }) {
  const query = useQuery({ ...recipeOptions(id), enabled: Boolean(apiUrl) });
  const recipe = query.data;
  if (recipe && recipe.steps.length > 0) {
    return <StepsContent recipeId={recipe.id} title={recipe.title} steps={recipe.steps} />;
  }
  return (
    <RecipeStatus
      loading={query.isPending && Boolean(apiUrl)}
      message={statusMessage({
        hasApi: Boolean(apiUrl),
        isMissing: recipe !== undefined,
        isError: query.isError,
      })}
      onRetry={
        query.isError
          ? () => {
              void query.refetch();
            }
          : undefined
      }
    />
  );
}

function statusMessage({
  hasApi,
  isMissing,
  isError,
}: {
  hasApi: boolean;
  /** The recipe does not exist or has no steps. */
  isMissing: boolean;
  isError: boolean;
}) {
  if (!hasApi) {
    return '接続先が未設定です。セットアップ後に手順を表示できます。';
  }
  if (isMissing) {
    return '手順が見つかりません';
  }
  if (isError) {
    return '手順を読み込めませんでした。通信状況を確認してお試しください。';
  }
  return '手順を読み込んでいます';
}

function StepsContent({
  recipeId,
  title,
  steps,
}: {
  recipeId: string;
  title: string;
  steps: RecipeStep[];
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const camera = useStepCamera();
  // A refetch may return fewer steps than the one on screen.
  const current = Math.min(index, steps.length - 1);
  const step = steps[current];
  if (!step) {
    return null;
  }
  const overlay = arOverlays[step.part];
  const isLast = current === steps.length - 1;
  const goNext = () => {
    if (isLast) {
      router.replace(`/recipes/${recipeId}/finish`);
      return;
    }
    setIndex(current + 1);
  };
  return (
    <MediaLayout
      media={
        <>
          {camera.preview ??
            (canTrackFace ? (
              <FaceMakeupCamera
                layers={
                  overlayVisible
                    ? recipeLayers(recipeId, [
                        { part: step.part, color: paintColor(step.colors), shape: step.shape },
                      ])
                    : []
                }
                annotation={overlayVisible ? { part: step.part, label: step.label } : undefined}
              />
            ) : (
              // Expo Go has no face tracker; Plan A's frame and overlays stand in.
              <FaceScene photo={arPhotos.camera}>
                {overlayVisible && overlay !== undefined ? (
                  <Image
                    accessible={false}
                    source={overlay}
                    contentFit="fill"
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                  />
                ) : null}
              </FaceScene>
            ))}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-50"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0))',
            }}
          />
        </>
      }
      header={
        <View className="gap-2.5 px-4" style={{ paddingTop: insets.top + 8 }}>
          <View className="flex-row items-center justify-between">
            <GlassIconButton
              icon={CLOSE}
              label="閉じる"
              onPress={() => {
                backOrHome();
              }}
            />
            <View className="min-h-9 shrink flex-row items-center gap-1.5 rounded-card border border-white bg-white/70 px-3.5">
              <Text className="shrink font-maru-bold text-label text-ink-primary">{title}</Text>
              <Text className="font-maru text-meta text-ink-secondary">
                {current + 1}/{steps.length}
              </Text>
            </View>
            {camera.preview ? (
              <View className="w-10" />
            ) : (
              <GlassIconButton
                icon={overlayVisible ? EYE : EYE_OFF}
                label={overlayVisible ? 'ガイドを隠す' : 'ガイドを表示'}
                onPress={() => {
                  setOverlayVisible(!overlayVisible);
                }}
              />
            )}
          </View>
          <View className="flex-row gap-1">
            {steps.map((_, position) => (
              <View
                // Steps are identified by their position; a part may appear twice.
                key={position}
                className={cn(
                  'h-1 flex-1 rounded-sm',
                  position <= current ? 'bg-accent-pink' : 'bg-white/70',
                )}
              />
            ))}
          </View>
          <Instruction step={step} number={current + 1} />
          {camera.control}
        </View>
      }
      footer={
        <View
          className="gap-3.5 rounded-t-sheet bg-white/80 px-4 pt-4"
          style={{
            paddingBottom: insets.bottom + 12,
            boxShadow: '0px -6px 12px rgba(196, 61, 112, 0.12)',
          }}
        >
          <ProductRow step={step} />
          <StepList steps={steps} current={current} onSelect={setIndex} />
          <Controls
            isFirst={current === 0}
            onPrevious={() => {
              setIndex(current - 1);
            }}
            onNext={goNext}
          />
        </View>
      }
    />
  );
}

function Instruction({ step, number }: { step: RecipeStep; number: number }) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View
      className="flex-row items-center gap-3 rounded-panel border border-white bg-white/80 py-3 pl-3 pr-3.5"
      style={{ boxShadow: '0px 6px 10px rgba(196, 61, 112, 0.12)' }}
    >
      <View className="size-8 items-center justify-center rounded-full bg-accent-rose">
        <Text className="font-maru-bold text-label text-white">{number}</Text>
      </View>
      <View className="flex-1 gap-px">
        <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
          {step.title}
        </Text>
        <Text className="font-maru text-meta text-ink-secondary">{step.hint}</Text>
      </View>
      {/* Voice guidance is not built yet; this mirrors Plan A's status chip only. */}
      <View className="min-h-6.5 flex-row items-center gap-0.75 rounded-chip bg-pastel-mint pl-1.5 pr-2">
        <SocialIcon name={MIC} size={14} color={ink} />
        <Text className="font-maru-bold text-micro text-ink-primary">音声ON</Text>
      </View>
    </View>
  );
}

/** ⑦'s suggested colors by name (#224): a color code tells a reader nothing. */
function colorNames(colors: string[]) {
  return [...new Set(colors.map((color) => colorName(color) ?? color))].join('・');
}

function ProductRow({ step }: { step: RecipeStep }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-row overflow-hidden rounded-xl" accessible={false}>
        {step.colors.map((color) => (
          <View
            key={color}
            className="h-11"
            style={{ width: 44 / step.colors.length, backgroundColor: color }}
          />
        ))}
      </View>
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{step.product}</Text>
        <Text className="font-maru text-meta text-ink-secondary">
          おすすめ色 {colorNames(step.colors)}
        </Text>
      </View>
    </View>
  );
}

function StepList({
  steps,
  current,
  onSelect,
}: {
  steps: RecipeStep[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
    >
      {steps.map((step, position) => {
        const active = position === current;
        return (
          <Pressable
            key={position}
            accessibilityRole="button"
            accessibilityLabel={`${position + 1} ${step.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => {
              onSelect(position);
            }}
            className="min-w-12 items-center gap-0.75 active:opacity-70"
          >
            <View
              className={cn(
                'size-9.5 items-center justify-center rounded-full',
                active ? 'border-selected border-accent-rose bg-white' : 'bg-neutral-soft',
              )}
            >
              <Image
                accessible={false}
                source={parts[step.part].icon}
                style={{ width: 18, height: 18 }}
              />
            </View>
            <Text
              className={cn(
                'font-maru-bold text-micro',
                active ? 'text-accent-rose' : 'text-ink-secondary',
              )}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Controls({
  isFirst,
  onPrevious,
  onNext,
}: {
  isFirst: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="前の手順"
        accessibilityState={{ disabled: isFirst }}
        disabled={isFirst}
        onPress={onPrevious}
        className={cn(
          'size-13 items-center justify-center rounded-full bg-neutral-soft active:opacity-70',
          isFirst && 'opacity-50',
        )}
      >
        <SocialIcon name={BACK} webGlyph="‹" size={22} color={ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onNext}
        className="min-h-13 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-4.5 active:opacity-80"
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        <SocialIcon name={NEXT} webGlyph="›" size={20} color="white" />
        <Text className="font-maru-bold text-action text-white">次へ</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="音声で操作（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-13 items-center justify-center rounded-full bg-pastel-mint"
      >
        <SocialIcon name={MIC} size={22} color={ink} />
      </View>
    </View>
  );
}
