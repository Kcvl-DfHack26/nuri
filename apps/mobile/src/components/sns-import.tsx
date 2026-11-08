import type { ComponentProps, ReactNode, Ref } from 'react';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CroppedPhoto } from '@/components/cropped-photo';
import { parts } from '@/components/recipes';
import {
  clipboardSample,
  recentImports,
  samplePost,
  sampleSteps,
} from '@/components/sns-import-sample';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { isSupportedPostUrl } from '@/lib/sns-url';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import lipstick from '../../assets/plan-a/import/lipstick.svg';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const LINK = Icon.select({ ios: 'link', android: import('@expo/material-symbols/link.xml') });
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});
const PLAY = Icon.select({
  ios: 'play.fill',
  android: import('@expo/material-symbols/play_arrow.xml'),
});
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});
const BOOKMARK = Icon.select({
  ios: 'bookmark',
  android: import('@expo/material-symbols/bookmark.xml'),
});

type IconName = ComponentProps<typeof SocialIcon>['name'];
type Phase = 'input' | 'reading' | 'done' | 'error' | 'saved';

const READING_STAGES = ['投稿を開く', 'メイクの手順を探す', '使っているコスメを探す'];
/** Nothing is read; each stage of the fixed sample advances after this delay. */
export const READING_STAGE_MS = 900;

// Plan A ④-1〜④-3, ④-5 and ④-E in one sheet over the make home. `saved` comes from ④-4.
export function SnsImport({ saved }: { saved: boolean }) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [stage, setStage] = useState(0);
  const input = useRef<TextInputInstance>(null);
  const shown = saved ? 'saved' : phase;

  useEffect(() => {
    if (phase !== 'reading') {
      return;
    }
    // Unmounting or cancelling clears the pending stage, so a closed sheet never advances.
    const timer = setTimeout(() => {
      if (stage < READING_STAGES.length - 1) {
        setStage(stage + 1);
      } else {
        setPhase('done');
      }
    }, READING_STAGE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, stage]);

  const submit = () => {
    if (!url.trim()) {
      return;
    }
    if (isSupportedPostUrl(url)) {
      setStage(0);
      setPhase('reading');
    } else {
      setPhase('error');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 30,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <SheetHeader />
        {shown === 'saved' ? null : (
          <UrlField
            ref={input}
            value={url}
            editable={shown === 'input' || shown === 'error'}
            invalid={shown === 'error'}
            onChange={(text) => {
              setUrl(text);
              if (phase === 'error') {
                setPhase('input');
              }
            }}
            onSubmit={submit}
          />
        )}
        {shown === 'input' ? <InputContent /> : null}
        {shown === 'reading' ? <ReadingCard stage={stage} /> : null}
        {shown === 'done' ? <DoneCard /> : null}
        {shown === 'error' ? <ErrorContent /> : null}
        {shown === 'saved' ? <SavedContent /> : null}
        {/* Plan A keeps the sheet's actions at its bottom edge. */}
        {shown === 'input' || shown === 'reading' || shown === 'done' ? (
          <View className="flex-1" />
        ) : null}
        {shown === 'input' ? (
          <SheetButton label="読み取る" disabled={!url.trim()} onPress={submit} />
        ) : null}
        {shown === 'reading' ? (
          <SheetButton
            label="キャンセル"
            outline
            onPress={() => {
              setPhase('input');
            }}
          />
        ) : null}
        {shown === 'done' ? (
          <SheetButton
            label="レシピとして保存"
            icon={BOOKMARK}
            onPress={() => {
              setPhase('saved');
            }}
          />
        ) : null}
        {shown === 'error' ? (
          <SheetButton
            label="別のURLを試す"
            onPress={() => {
              setPhase('input');
              input.current?.focus();
            }}
          />
        ) : null}
        {shown === 'saved' ? (
          <>
            <SheetButton label="自分の顔で試す" />
            <SheetButton label="レシピを見る" outline />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SheetHeader() {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="flex-row items-center gap-3">
      <Text
        accessibilityRole="header"
        className="flex-1 font-maru-bold text-heading text-ink-primary"
      >
        SNSの動画をレシピにする
      </Text>
      {/* hitSlop cannot reach past this 36pt row, so the 48pt target holds the 36pt circle. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        onPress={() => {
          backOrHome();
        }}
        className="-my-1.5 -mr-1.5 size-12 items-center justify-center active:opacity-70"
      >
        <View className="size-9 items-center justify-center rounded-full bg-neutral-soft">
          <SocialIcon name={CLOSE} size={18} color={ink} />
        </View>
      </Pressable>
    </View>
  );
}

function UrlField({
  ref,
  value,
  editable,
  invalid,
  onChange,
  onSubmit,
}: {
  ref: Ref<TextInputInstance>;
  value: string;
  editable: boolean;
  invalid: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
}) {
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View
      className={cn(
        'min-h-13 flex-row items-center gap-2 rounded-control bg-white pl-3.5 pr-1.5',
        invalid ? 'border-fine border-accent-rose' : 'border border-black',
      )}
    >
      <SocialIcon name={LINK} size={20} color={secondary} />
      <TextInput
        ref={ref}
        accessibilityLabel="投稿のURL"
        value={value}
        editable={editable}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="投稿のURLを貼り付け"
        placeholderTextColorClassName="accent-link-placeholder"
        cursorColorClassName="accent-accent-rose"
        selectionColorClassName="accent-accent-rose"
        keyboardType="url"
        inputMode="url"
        textContentType="URL"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        clearButtonMode="while-editing"
        className="min-h-12 flex-1 py-2 font-maru text-meta text-ink-primary"
      />
    </View>
  );
}

// ④-1: the clipboard and history need device storage, so they keep Plan A's look but stay inactive.
function InputContent() {
  const rose = useTokenColor('--color-accent-rose');
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="コピーしたリンクを使う（準備中）"
        accessibilityState={{ disabled: true }}
        className="flex-row items-center gap-3 rounded-card bg-bg-base py-3 pl-3.5 pr-3"
      >
        <SocialIcon name={LINK} size={22} color={rose} />
        <View className="flex-1 gap-px">
          <Text className="font-maru-bold text-label text-ink-primary">
            コピーしたリンクがあります
          </Text>
          <Text className="font-maru text-meta text-ink-secondary" numberOfLines={1}>
            {clipboardSample}
          </Text>
        </View>
        <Text className="font-maru-bold text-action text-accent-rose">使う</Text>
      </View>
      <Text className="text-center font-maru text-meta text-ink-secondary">
        Instagram・YouTube・TikTokの動画に対応しています
      </Text>
      {/* Fetching posts waits on each service's terms and the poster's permission. */}
      <Text className="text-center font-maru text-meta text-ink-secondary">
        いまは投稿を読み取らず、見本のレシピを表示します
      </Text>
      <View className="gap-2">
        <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
          最近取り込んだ投稿
        </Text>
        {recentImports.map((item) => (
          <View
            key={item.title}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${item.title}、${item.source}（準備中）`}
            accessibilityState={{ disabled: true }}
            className="min-h-12 flex-row items-center gap-3"
          >
            <View className="size-11 overflow-hidden rounded-xl">
              <CroppedPhoto source={item.photo} crop={item.crop} />
            </View>
            <View className="flex-1 gap-px">
              <Text className="font-maru-bold text-label text-ink-primary">{item.title}</Text>
              <Text className="font-maru text-meta text-ink-secondary">{item.source}</Text>
            </View>
            <SocialIcon name={NEXT} size={18} color={secondary} />
          </View>
        ))}
      </View>
    </>
  );
}

function PostSummary({ done }: { done: boolean }) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-24 w-18 items-center justify-center overflow-hidden rounded-thumbnail">
        <CroppedPhoto source={samplePost.photo} crop={samplePost.crop} />
        <View className="size-7 items-center justify-center rounded-full bg-white/80">
          <SocialIcon name={PLAY} size={14} color={ink} />
        </View>
      </View>
      <View className="flex-1 items-start gap-1">
        <View
          className={cn(
            // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- Keep the fixed radius of this 22pt progress badge when text wraps.
            'min-h-5.5 flex-row items-center gap-1 rounded-[11px] px-2',
            done ? 'bg-pastel-mint' : 'bg-pastel-pink',
          )}
        >
          {done ? <SocialIcon name={CHECK} size={12} color={ink} /> : null}
          <Text className="font-maru-bold text-micro text-ink-primary">
            {done ? '読み取り完了' : '読み取り中'}
          </Text>
        </View>
        <Text className="font-maru-bold text-label text-ink-primary">{samplePost.title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{samplePost.author} の投稿</Text>
      </View>
    </View>
  );
}

function ResultCard({ children }: { children: ReactNode }) {
  return (
    <View className="gap-3.5 rounded-control-compact border-fine border-line-soft bg-bg-surface p-3.5">
      {children}
    </View>
  );
}

// ④-2: progress through the fixed stages; Plan A shows the first stage done and the second active.
function ReadingCard({ stage }: { stage: number }) {
  const surface = useTokenColor('--color-bg-surface');
  const progress = (stage + 0.35) / READING_STAGES.length;
  return (
    <ResultCard>
      <PostSummary done={false} />
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="読み取りの進み具合"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        className="h-2 overflow-hidden rounded bg-ink-primary/12"
      >
        <View
          className="h-2 rounded bg-accent-rose"
          style={{ width: `${progress * 100}%` as const }}
        />
      </View>
      {READING_STAGES.map((label, index) => {
        const state = index < stage ? 'done' : index === stage ? 'active' : 'pending';
        return (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label}、${{ done: '完了', active: '実行中', pending: '待機中' }[state]}`}
            className="flex-row items-center gap-2.5"
          >
            {state === 'done' ? (
              <View className="size-5.5 items-center justify-center rounded-full bg-accent-rose">
                <SocialIcon name={CHECK} size={14} color={surface} />
              </View>
            ) : (
              <View
                className={cn(
                  'size-5.5 rounded-full border-2',
                  state === 'active' ? 'border-accent-rose' : 'border-ink-primary/30',
                )}
              />
            )}
            <Text
              className={cn(
                state === 'pending'
                  ? 'font-maru text-ui text-ink-secondary'
                  : 'font-maru-bold text-label text-ink-primary',
              )}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </ResultCard>
  );
}

// ④-3: the step row opens ④-4; the cosmetics check belongs to a later flow.
function DoneCard() {
  const rose = useTokenColor('--color-accent-rose');
  return (
    <ResultCard>
      <PostSummary done />
      <Text className="font-maru text-meta text-ink-secondary">
        手順を{sampleSteps.length}つ見つけました
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`読み取った手順を確認、${sampleSteps.map((step) => step.label).join('、')}`}
        onPress={() => {
          router.push('/import/steps');
        }}
        className="flex-row justify-between active:opacity-70"
      >
        {sampleSteps.map((step) => (
          <View key={step.part} className="items-center gap-1">
            <View
              className={cn(
                'size-10 items-center justify-center rounded-full',
                parts[step.part].iconBackground,
              )}
            >
              <Image
                accessible={false}
                source={parts[step.part].icon}
                style={{ width: 20, height: 20 }}
              />
            </View>
            <Text className="font-maru-bold text-micro text-ink-primary">{step.label}</Text>
          </View>
        ))}
      </Pressable>
      <View className="h-px bg-line-soft" />
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`使っているコスメを${samplePost.productCount}点検出、確認する（準備中）`}
        accessibilityState={{ disabled: true }}
        className="flex-row items-center gap-2"
      >
        <Image accessible={false} source={lipstick} style={{ width: 20, height: 20 }} />
        <Text className="flex-1 font-maru-bold text-label text-ink-primary">
          使っているコスメを{samplePost.productCount}点検出
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Text className="font-maru-bold text-label text-accent-rose">確認する</Text>
          <SocialIcon name={NEXT} size={16} color={rose} />
        </View>
      </View>
    </ResultCard>
  );
}

// ④-E: why a post cannot be read; the field above keeps the text so it can be fixed.
function ErrorContent() {
  const rose = useTokenColor('--color-accent-rose');
  return (
    <View className="flex-1 justify-center gap-3">
      <View className="flex-row items-center gap-3">
        <View className="size-11 items-center justify-center rounded-full bg-pastel-pink">
          <SocialIcon name={CLOSE} size={22} color={rose} />
        </View>
        <Text
          accessibilityRole="header"
          className="flex-1 font-maru-bold text-heading text-ink-primary"
        >
          この投稿は読み取れませんでした
        </Text>
      </View>
      <View className="gap-2.5 rounded-card bg-bg-base px-4 py-3.5">
        <Text className="font-maru-bold text-label text-ink-primary">
          こんなときは読み取れません
        </Text>
        {[
          '投稿が非公開になっている',
          'メイクの手順が映っていない動画',
          '対応していないサービスのURL',
        ].map((reason) => (
          <View key={reason} className="flex-row items-center gap-2">
            <View className="size-1.5 rounded-full bg-accent-rose" />
            <Text className="flex-1 font-maru text-ui text-ink-secondary">{reason}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ④-5: nothing is stored yet, so the follow-up actions stay inactive.
function SavedContent() {
  const surface = useTokenColor('--color-bg-surface');
  return (
    <View className="flex-1 items-center justify-center gap-2.5 py-4">
      <View className="h-35 w-28">
        <View className="absolute inset-0 overflow-hidden rounded-panel">
          <CroppedPhoto source={samplePost.photo} crop={samplePost.crop} />
        </View>
        <View className="absolute left-22.25 top-29.25 size-8.5 items-center justify-center rounded-full border-3 border-bg-surface bg-accent-rose">
          <SocialIcon name={CHECK} size={20} color={surface} />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        className="text-center font-maru-bold text-headline text-ink-primary"
      >
        レシピに保存しました
      </Text>
      <Text className="text-center font-maru text-meta text-ink-secondary">
        {samplePost.title}・{samplePost.author} の投稿
      </Text>
      <View className="flex-row flex-wrap justify-center gap-1.5">
        {[
          `手順 ${sampleSteps.length}`,
          `コスメ ${samplePost.productCount}`,
          '元の投稿へのリンク付き',
        ].map((chip) => (
          <View key={chip} className="min-h-6.5 justify-center rounded-chip bg-bg-base px-2.5">
            <Text className="font-maru text-meta text-ink-primary">{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Plan A's 52pt sheet button. Without onPress it is a Plan A action that is not built yet.
function SheetButton({
  label,
  outline = false,
  icon,
  disabled = false,
  onPress,
}: {
  label: string;
  outline?: boolean;
  icon?: IconName;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const pending = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pending ? `${label}（準備中）` : label}
      accessibilityState={{ disabled: disabled || pending }}
      disabled={disabled || pending}
      onPress={onPress}
      className={cn(
        'min-h-13 flex-row items-center justify-center gap-1.5 rounded-control px-4.5 active:opacity-80',
        outline ? 'border border-black bg-white' : 'bg-accent-rose',
        disabled && 'opacity-50',
      )}
      style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
    >
      {icon ? <SocialIcon name={icon} size={20} color="white" /> : null}
      <Text
        className={cn('font-maru-bold text-action', outline ? 'text-ink-primary' : 'text-white')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
