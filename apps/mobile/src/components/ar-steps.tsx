import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MakeupStep, PartId } from '@/components/recipes';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { arPhotos, findRecipe, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const EYE = Icon.select({ ios: 'eye', android: import('@expo/material-symbols/visibility.xml') });
const EYE_OFF = Icon.select({
  ios: 'eye.slash',
  android: import('@expo/material-symbols/visibility_off.xml'),
});
const MIC = Icon.select({ ios: 'mic', android: import('@expo/material-symbols/mic.xml') });
const PLAY = Icon.select({ ios: 'play', android: import('@expo/material-symbols/play_arrow.xml') });
const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});

// Plan A ⑦ AR手順. The camera and face tracking come later; Plan A's frame and overlays stand in.
export function ArSteps({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const recipe = findRecipe(id);
  const detail = recipe?.detail;
  const step = detail?.steps[index];
  if (!recipe || !detail || !step) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="font-maru-bold text-heading text-ink-primary">手順が見つかりません</Text>
        <GlassIconButton
          icon={BACK}
          label="戻る"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
    );
  }
  const { steps, overview } = detail;
  const isLast = index === steps.length - 1;
  const goNext = () => {
    if (isLast) {
      router.replace(`/recipes/${recipe.id}/finish`);
      return;
    }
    setIndex(index + 1);
  };
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.camera}>
        {overlayVisible ? (
          <Image
            accessible={false}
            source={step.overlay}
            contentFit="fill"
            style={{ position: 'absolute', width: '100%', height: '100%' }}
          />
        ) : null}
      </FaceScene>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-[200px]"
        style={{
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0))',
        }}
      />
      <View className="absolute inset-x-4 gap-2.5" style={{ top: insets.top + 8 }}>
        <View className="flex-row items-center justify-between">
          <GlassIconButton
            icon={CLOSE}
            label="閉じる"
            onPress={() => {
              backOrHome();
            }}
          />
          <View className="min-h-9 flex-row items-center gap-1.5 rounded-[18px] border border-white bg-white/70 px-3.5">
            <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
            <Text className="font-maru text-meta text-ink-secondary">
              {index + 1}/{overview.length}
            </Text>
          </View>
          <GlassIconButton
            icon={overlayVisible ? EYE : EYE_OFF}
            label={overlayVisible ? 'ガイドを隠す' : 'ガイドを表示'}
            onPress={() => {
              setOverlayVisible(!overlayVisible);
            }}
          />
        </View>
        <View className="flex-row gap-1">
          {overview.map((partId, position) => (
            <View
              key={partId}
              className={cn(
                'h-1 flex-1 rounded-sm',
                position <= index ? 'bg-accent-pink' : 'bg-white/70',
              )}
            />
          ))}
        </View>
        <Instruction step={step} number={index + 1} />
      </View>
      <View
        className="absolute inset-x-0 bottom-0 gap-3.5 rounded-t-[28px] bg-white/80 px-4 pt-4"
        style={{
          paddingBottom: insets.bottom + 12,
          boxShadow: '0px -6px 12px rgba(196, 61, 112, 0.12)',
        }}
      >
        <ProductRow step={step} />
        <StepList overview={overview} steps={steps} current={index} onSelect={setIndex} />
        <Controls
          isFirst={index === 0}
          onPrevious={() => {
            setIndex(index - 1);
          }}
          onNext={goNext}
        />
      </View>
    </View>
  );
}

function Instruction({ step, number }: { step: MakeupStep; number: number }) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View
      className="flex-row items-center gap-3 rounded-[20px] border border-white bg-white/80 py-3 pl-3 pr-3.5"
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
      <View className="min-h-[26px] flex-row items-center gap-[3px] rounded-[13px] bg-pastel-mint pl-1.5 pr-2">
        <SocialIcon name={MIC} size={14} color={ink} />
        <Text className="font-maru-bold text-micro text-ink-primary">音声ON</Text>
      </View>
    </View>
  );
}

function ProductRow({ step }: { step: MakeupStep }) {
  const ink = useTokenColor('--color-ink-primary');
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
          おすすめ色 {step.colors.join('・')}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="お手本を再生（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-12 items-center justify-center"
      >
        <View className="size-9 items-center justify-center rounded-full bg-neutral-soft">
          <SocialIcon name={PLAY} size={16} color={ink} />
        </View>
      </View>
    </View>
  );
}

function StepList({
  overview,
  steps,
  current,
  onSelect,
}: {
  overview: PartId[];
  steps: MakeupStep[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View className="flex-row justify-between">
      {overview.map((partId, position) => {
        const step = steps[position];
        const active = position === current;
        const label = step?.label ?? parts[partId].label;
        return (
          <Pressable
            key={partId}
            accessibilityRole="button"
            accessibilityLabel={
              step ? `${position + 1} ${label}` : `${position + 1} ${label}（準備中）`
            }
            accessibilityState={{ selected: active, disabled: !step }}
            disabled={!step}
            onPress={() => {
              onSelect(position);
            }}
            className="min-w-12 items-center gap-[3px] active:opacity-70"
          >
            <View
              className={cn(
                'size-[38px] items-center justify-center rounded-full',
                active ? 'border-[2.5px] border-accent-rose bg-white' : 'bg-neutral-soft',
              )}
            >
              <Image
                accessible={false}
                source={parts[partId].icon}
                style={{ width: 18, height: 18 }}
              />
            </View>
            <Text
              className={cn(
                'font-maru-bold text-micro',
                active ? 'text-accent-rose' : 'text-ink-secondary',
              )}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
          'size-[52px] items-center justify-center rounded-full bg-neutral-soft active:opacity-70',
          isFirst && 'opacity-50',
        )}
      >
        <SocialIcon name={BACK} size={22} color={ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onNext}
        className="min-h-[52px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-[18px] active:opacity-80"
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        <SocialIcon name={NEXT} size={20} color="white" />
        <Text className="font-maru-bold text-action text-white">次へ</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="音声で操作（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-[52px] items-center justify-center rounded-full bg-pastel-mint"
      >
        <SocialIcon name={MIC} size={22} color={ink} />
      </View>
    </View>
  );
}
