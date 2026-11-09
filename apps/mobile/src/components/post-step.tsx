import type { ReactNode } from 'react';

import { Host, Icon, Picker } from '@expo/ui';
import { makeupParts } from '@starter/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cosmetic } from '@/components/post-draft';

import { GlassIconButton } from '@/components/glass-icon-button';
import { AreaEditor } from '@/components/post-area';
import { BottomCta, DashedButton, PostHeader, PrimaryButton } from '@/components/post-chrome';
import { ColorField } from '@/components/post-color';
import { cosmeticCandidates, usePostDraft } from '@/components/post-draft';
import { StepSegment } from '@/components/post-segment';
import { parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import sparkleRoseSmall from '../../assets/plan-a/post/sparkle-rose-small.svg';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const ADD = Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') });
const SEARCH = Icon.select({
  ios: 'magnifyingglass',
  android: import('@expo/material-symbols/search.xml'),
});
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});
const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});

function useStep(index: string) {
  const { draft, updateStep } = usePostDraft();
  const position = Number(index);
  const step = Number.isInteger(position) ? draft.steps[position] : undefined;
  return { step, position, updateStep };
}

function MissingStep() {
  const insets = useSafeAreaInsets();
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

// Plan A ⑫-5 手順を編集. Edits apply to the draft as they are made; the segment is played and moved
// on the device (#181); dragging the area handles is not built.
export function PostStepEdit({ index }: { index: string }) {
  const { step, position, updateStep } = useStep(index);
  const { draft, setDraft } = usePostDraft();
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const addIcon = <SocialIcon name={ADD} size={20} color={ink} />;
  if (!step) {
    return <MissingStep />;
  }
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <PostHeader title={`手順${position + 1}を編集`} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-4 px-4 pb-6 pt-2"
      >
        <StepSegment step={step} position={position} />
        <Field label="部位">
          {/* Plan A ⑫-5 has no part field; the steps are split by time, so the user names the part. */}
          <Host colorScheme="light" matchContents style={{ alignSelf: 'flex-start' }}>
            <Picker
              testID="部位"
              appearance="menu"
              selectedValue={step.part}
              onValueChange={(part) => {
                // The area read from the video belongs to the old part.
                updateStep(position, { part, shape: null });
              }}
            >
              {makeupParts.map((part) => (
                <Picker.Item key={part} label={parts[part].label} value={part} />
              ))}
            </Picker>
          </Host>
        </Field>
        <Field label="タイトル">
          <TextInput
            accessibilityLabel="タイトル"
            placeholder={parts[step.part].label}
            placeholderTextColor={secondary}
            maxLength={40}
            value={step.title}
            onChangeText={(title) => {
              updateStep(position, { title });
            }}
            className="rounded-2xl border border-ink-primary bg-bg-surface px-3.5 py-3.25 font-maru text-ui text-ink-primary"
          />
        </Field>
        <Field label="説明">
          <TextInput
            accessibilityLabel="説明"
            value={step.description}
            maxLength={200}
            multiline
            onChangeText={(description) => {
              updateStep(position, { description });
            }}
            className="rounded-2xl border border-ink-primary bg-bg-surface px-3.5 py-3.25 font-maru text-ui text-ink-primary"
          />
        </Field>
        <ColorField step={step} position={position} />
        <AreaEditor step={step} position={position} />
        <View className="gap-2">
          <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
            使ったコスメ
          </Text>
          {step.cosmetics.map((cosmetic) => (
            <CosmeticRow
              key={cosmetic.id}
              cosmetic={cosmetic}
              detail={cosmetic.shade}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${cosmetic.name}を外す`}
                  hitSlop={14}
                  onPress={() => {
                    updateStep(position, {
                      cosmetics: step.cosmetics.filter((item) => item.id !== cosmetic.id),
                    });
                  }}
                  className="active:opacity-70"
                >
                  <SocialIcon name={CLOSE} size={20} color={ink} />
                </Pressable>
              }
            />
          ))}
          <DashedButton
            label="コスメを追加"
            icon={addIcon}
            onPress={() => {
              router.push(`/post/cosmetics/${position}`);
            }}
          />
        </View>
        <DeleteStepButton
          // A recipe needs at least one step, so the last one stays.
          canDelete={draft.steps.length > 1}
          onDelete={() => {
            setDraft((current) => ({
              ...current,
              steps: current.steps.filter((_, at) => at !== position),
            }));
            router.back();
          }}
        />
      </ScrollView>
      <BottomCta>
        <PrimaryButton
          label="この手順を保存"
          onPress={() => {
            router.back();
          }}
        />
      </BottomCta>
    </View>
  );
}

/**
 * ⑫-5 (#201): deletes the step after asking. Its segment becomes time no step covers; its frame is
 * deleted with the draft's other files when the flow closes.
 */
function DeleteStepButton({ canDelete, onDelete }: { canDelete: boolean; onDelete: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !canDelete }}
      disabled={!canDelete}
      onPress={() => {
        Alert.alert('この手順を削除しますか？', undefined, [
          { text: 'キャンセル', style: 'cancel' },
          { text: '削除', style: 'destructive', onPress: onDelete },
        ]);
      }}
      className={cn(
        'min-h-12 items-center justify-center rounded-full active:opacity-70',
        !canDelete && 'opacity-50',
      )}
    >
      <Text className="font-maru-bold text-label text-accent-rose">この手順を削除</Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="font-maru-bold text-label text-ink-primary">{label}</Text>
      {children}
    </View>
  );
}

function CosmeticRow({
  cosmetic,
  detail,
  trailing,
  selected = false,
}: {
  cosmetic: Cosmetic;
  detail: string;
  trailing?: ReactNode;
  selected?: boolean;
}) {
  return (
    <View
      className={cn(
        'min-h-12 flex-row items-center gap-3 rounded-card border-fine px-3 py-2.5',
        selected ? 'border-accent-rose bg-bg-base' : 'border-line-soft bg-bg-surface',
      )}
    >
      <View className="size-9 rounded-full" style={{ backgroundColor: cosmetic.color }} />
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{cosmetic.name}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
      </View>
      {trailing}
    </View>
  );
}

// Plan A ⑫-6 使ったコスメを選ぶ, presented as a sheet over ⑫-5. Only the cosmetics Plan A
// shows as found in the clip are listed; catalog search is not built.
export function PostCosmeticPicker({ index }: { index: string }) {
  const { step, position, updateStep } = useStep(index);
  const insets = useSafeAreaInsets();
  const ink = useTokenColor('--color-ink-primary');
  const candidates = (step && cosmeticCandidates[step.part]) ?? [];
  const [selected, setSelected] = useState(
    () => new Set(step?.cosmetics.map((cosmetic) => cosmetic.id)),
  );
  if (!step) {
    return <MissingStep />;
  }
  const chosen = candidates.filter((cosmetic) => selected.has(cosmetic.id));
  return (
    <ScrollView
      className="flex-1 bg-bg-surface"
      contentInsetAdjustmentBehavior="never"
      contentContainerClassName="gap-3.5 px-4 pt-6"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
    >
      <View className="flex-row items-center gap-2">
        <Text
          accessibilityRole="header"
          className="flex-1 font-maru-bold text-headline text-ink-primary"
        >
          使ったコスメを追加
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="閉じる"
          onPress={() => {
            router.back();
          }}
          className="size-12 items-center justify-center rounded-full active:opacity-70"
        >
          <SocialIcon name={CLOSE} size={22} color={ink} />
        </Pressable>
      </View>
      <View
        accessible
        accessibilityRole="search"
        accessibilityLabel="商品名・ブランドで検索（準備中）"
        accessibilityState={{ disabled: true }}
        className="min-h-12 flex-row items-center gap-2 rounded-3xl border border-ink-primary px-3.5"
      >
        <SocialIcon name={SEARCH} size={22} color={ink} />
        <Text className="flex-1 font-maru text-ui text-ink-secondary">商品名・ブランドで検索</Text>
      </View>
      <View className="flex-row gap-1.5">
        <View
          accessible
          accessibilityLabel="動画から"
          accessibilityState={{ selected: true }}
          className="min-h-8 justify-center rounded-2xl bg-pastel-pink px-3.5"
        >
          <Text className="font-maru-bold text-label text-accent-rose">動画から</Text>
        </View>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="すべて（準備中）"
          accessibilityState={{ disabled: true }}
          className="min-h-8 justify-center rounded-2xl border-fine border-line-soft px-3.5"
        >
          <Text className="font-maru-bold text-label text-ink-primary">すべて</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Image accessible={false} source={sparkleRoseSmall} style={{ width: 16, height: 16 }} />
        <Text className="flex-1 font-maru text-meta text-ink-secondary">
          この手順の動画に映っていたコスメ
        </Text>
      </View>
      <View className="gap-2">
        {candidates.length === 0 ? (
          <Text className="font-maru text-ui text-ink-secondary">
            この手順の動画ではコスメが見つかりませんでした
          </Text>
        ) : null}
        {candidates.map((cosmetic) => {
          const checked = selected.has(cosmetic.id);
          return (
            <Pressable
              key={cosmetic.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${cosmetic.name}、${cosmetic.category}・${cosmetic.shade}`}
              accessibilityState={{ checked }}
              onPress={() => {
                const next = new Set(selected);
                if (checked) {
                  next.delete(cosmetic.id);
                } else {
                  next.add(cosmetic.id);
                }
                setSelected(next);
              }}
              className="active:opacity-70"
            >
              <CosmeticRow
                cosmetic={cosmetic}
                detail={`${cosmetic.category}・${cosmetic.shade}`}
                selected={checked}
                trailing={
                  checked ? (
                    <View className="size-6 items-center justify-center rounded-full bg-accent-rose">
                      <SocialIcon name={CHECK} size={16} color="white" />
                    </View>
                  ) : null
                }
              />
            </Pressable>
          );
        })}
      </View>
      {chosen.length > 0 ? (
        <PrimaryButton
          label={`${chosen.length}点を追加する`}
          onPress={() => {
            updateStep(position, { cosmetics: chosen });
            router.back();
          }}
        />
      ) : (
        <PrimaryButton label="コスメを選んでください" />
      )}
    </ScrollView>
  );
}
