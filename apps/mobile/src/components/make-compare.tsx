import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PartId } from '@/components/recipes';
import type { RecipeStep } from '@/lib/recipes';

import { FaceScene } from '@/components/face-scene';
import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { MediaLayout } from '@/components/media-layout';
import { arPhotos, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiUrl } from '@/lib/api';
import { useLayoutSize } from '@/lib/layout';
import { backOrHome } from '@/lib/navigation';
import { recipeOptions } from '@/lib/recipes';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/ios_share.xml'),
});
const COMPARE = Icon.select({
  ios: 'arrow.left.and.line.vertical.and.arrow.right',
  android: import('@expo/material-symbols/arrow_range.xml'),
});
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});
const DOWNLOAD = Icon.select({
  ios: 'arrow.down.to.line',
  android: import('@expo/material-symbols/download.xml'),
});
const PLUS = Icon.select({
  ios: 'plus.circle',
  android: import('@expo/material-symbols/add_circle.xml'),
});

/** The 48pt handle stays fully on screen; VoiceOver/TalkBack move the divider in 10% steps. */
const HANDLE_SIZE = 48;
const STEP = 0.1;
/** Plan A's sample layer state. Layers cannot be re-rendered without the AR pipeline yet. */
const SAMPLE_HIDDEN_PARTS: PartId[] = ['shading'];

// Plan A ⑪ 完成プレビュー（比較）: drag the divider to compare the bare face with the finished look.
export function MakeCompare({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { width, onLayout } = useLayoutSize();
  const rose = useTokenColor('--color-accent-rose');
  // Divider position as a share of the width, so it survives rotation and window resizing.
  const [position, setPosition] = useState(0.5);
  const edge = width > 0 ? Math.min(0.5, HANDLE_SIZE / 2 / width) : 0;
  const clamp = (value: number) => Math.min(Math.max(value, edge), 1 - edge);
  // A tap or drag anywhere on the photo moves the divider under the finger.
  function moveDivider(event: GestureResponderEvent) {
    setPosition(event.nativeEvent.locationX / Math.max(width, 1));
  }
  const shown = clamp(position);
  const x = shown * width;
  const percent = Math.round(shown * 100);
  // The step chips come from the recipe that ⑦ already loaded; the photos do not need it.
  const query = useQuery({ ...recipeOptions(id), enabled: Boolean(apiUrl) });

  return (
    <MediaLayout
      media={
        <>
          <View
            className="absolute inset-0"
            onLayout={onLayout}
            onStartShouldSetResponder={() => true}
            onResponderGrant={moveDivider}
            onResponderMove={moveDivider}
          >
            <FaceScene photo={arPhotos.camera} />
            <Slice from={x} to={width} width={width} className="inset-y-0">
              <FaceScene photo={arPhotos.finished} />
            </Slice>
            <View
              pointerEvents="none"
              className="absolute inset-y-0 w-0.75 bg-white"
              style={{ left: x - 1.5, boxShadow: '0px 0px 6px rgba(0, 0, 0, 0.18)' }}
            />
            <View
              pointerEvents="none"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="メイク前とメイク後の境目"
              accessibilityValue={{ text: `メイク前${percent}% メイク後${100 - percent}%` }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => {
                const delta = event.nativeEvent.actionName === 'increment' ? STEP : -STEP;
                setPosition(clamp(shown + delta));
              }}
              // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- The compare handle aligns with the eyes in the Plan A crop.
              className="absolute top-[39.1%] size-12 items-center justify-center rounded-full bg-white"
              style={{
                left: x - HANDLE_SIZE / 2,
                boxShadow: '0px 4px 7px rgba(196, 61, 112, 0.2)',
              }}
            >
              <SocialIcon name={COMPARE} webGlyph="↔" size={24} color={rose} />
            </View>
          </View>
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-42.5"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0))',
            }}
          />
          {/* Each tag is clipped with its side of the photo, like the photos themselves. */}
          <Slice from={0} to={x} width={width} style={{ top: insets.top + 64 }}>
            <Tag
              label="Before"
              className="ml-4 self-start bg-white/78"
              textClassName="text-ink-primary"
            />
          </Slice>
          <Slice from={x} to={width} width={width} style={{ top: insets.top + 64 }}>
            <Tag
              label="After"
              className="mr-4 self-end bg-accent-rose"
              textClassName="text-white"
            />
          </Slice>
        </>
      }
      header={
        <View
          className="flex-row items-center justify-between gap-2 px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <GlassIconButton
            icon={BACK}
            label="戻る"
            onPress={() => {
              backOrHome();
            }}
          />
          {/* Shrinks so large text wraps the title instead of pushing the share button away. */}
          <View className="min-h-9 shrink flex-row items-center rounded-card border border-white bg-white/70 px-4">
            <Text
              accessibilityRole="header"
              className="shrink text-center font-maru-bold text-label text-ink-primary"
            >
              完成プレビュー
            </Text>
          </View>
          <GlassIconButton icon={SHARE} label="共有（準備中）" />
        </View>
      }
      footer={
        <View
          className="gap-3.5 rounded-t-sheet bg-white/86 px-4 pt-4.5"
          style={{
            paddingBottom: insets.bottom + 12,
            boxShadow: '0px -6px 12px rgba(196, 61, 112, 0.12)',
          }}
        >
          <View className="flex-row flex-wrap items-center justify-between gap-x-3">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-heading text-ink-primary"
            >
              手順を重ねて確認
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">タップでオン・オフ</Text>
          </View>
          <StepLayers
            steps={query.data?.steps ?? []}
            isLoading={query.isPending && Boolean(apiUrl)}
            isError={query.isError}
            onRetry={() => {
              void query.refetch();
            }}
          />
          <Controls />
        </View>
      }
    />
  );
}

function StepLayers({
  steps,
  isLoading,
  isError,
  onRetry,
}: {
  steps: RecipeStep[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (steps.length > 0) {
    return (
      <View className="flex-row flex-wrap gap-2">
        {steps.map((step, index) => (
          <LayerChip
            // A recipe may work on the same part twice, so the position is the key.
            key={index}
            part={step.part}
            label={step.label}
            visible={!SAMPLE_HIDDEN_PARTS.includes(step.part)}
          />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <Feedback
        message="手順を読み込めませんでした。通信状況を確認してお試しください。"
        onRetry={onRetry}
      />
    );
  }
  if (isLoading) {
    return <Feedback message="手順を読み込んでいます" loading />;
  }
  return null;
}

/** Shows the slice of a full-width layer between `from` and `to`, measured from the left edge. */
function Slice({
  from,
  to,
  width,
  className,
  style,
  children,
}: {
  from: number;
  to: number;
  width: number;
  className?: string;
  style?: { top: number };
  children: ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      className={cn('absolute overflow-hidden', className)}
      style={[{ left: from, width: Math.max(to - from, 0) }, style]}
    >
      <View style={{ marginLeft: -from, width, height: '100%' }}>{children}</View>
    </View>
  );
}

function Tag({
  label,
  className,
  textClassName,
}: {
  label: string;
  className: string;
  textClassName: string;
}) {
  return (
    <View
      className={cn('rounded-overlay-label border border-white px-3 py-1.25', className)}
      style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
    >
      <Text className={cn('font-maru-bold text-label', textClassName)}>{label}</Text>
    </View>
  );
}

function LayerChip({ part, label, visible }: { part: PartId; label: string; visible: boolean }) {
  const rose = useTokenColor('--color-accent-rose');
  const secondary = useTokenColor('--color-ink-secondary');
  // Turning a step's layer on or off needs the AR renderer, so the chips show Plan A's state only.
  return (
    <View
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={`${label}（準備中）`}
      accessibilityState={{ checked: visible, disabled: true }}
      className={cn(
        'min-h-9 flex-row items-center gap-1 rounded-card border-fine px-3',
        visible ? 'border-accent-rose bg-pastel-pink' : 'border-line-soft bg-white',
      )}
    >
      {visible ? (
        <SocialIcon name={CHECK} webGlyph="✓" size={16} color={rose} />
      ) : (
        <Image
          accessible={false}
          source={parts[part].icon}
          tintColor={secondary}
          style={{ width: 16, height: 16 }}
        />
      )}
      <Text
        className={cn(
          'font-maru-bold text-label',
          visible ? 'text-accent-rose' : 'text-ink-secondary',
        )}
      >
        {label}
      </Text>
    </View>
  );
}

function Controls() {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="写真を保存（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-13 items-center justify-center rounded-full bg-neutral-soft"
      >
        <SocialIcon name={DOWNLOAD} size={22} color={ink} />
      </View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="レシピを投稿する（準備中）"
        accessibilityState={{ disabled: true }}
        className="min-h-13 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-4.5"
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        <SocialIcon name={PLUS} webGlyph="+" size={20} color="white" />
        <Text className="font-maru-bold text-action text-white">レシピを投稿する</Text>
      </View>
    </View>
  );
}
