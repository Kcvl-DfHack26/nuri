import { Icon } from '@expo/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CroppedPhoto } from '@/components/cropped-photo';
import { Feedback } from '@/components/feedback';
import { OpenNativeAppLink } from '@/components/open-native-app-link';
import { RecipeList } from '@/components/recipe-list';
import { partCards, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiUrl } from '@/lib/api';
import { recipeListOptions, recipePartsOptions } from '@/lib/recipes';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const SEARCH = Icon.select({
  ios: 'magnifyingglass',
  android: import('@expo/material-symbols/search.xml'),
});
const LINK = Icon.select({ ios: 'link', android: import('@expo/material-symbols/link.xml') });

type Scope = 'whole' | 'parts';

// Plan A ① ホーム（全体メイク） and ② ホーム（部位メイク）.
export function Home() {
  const insets = useSafeAreaInsets();
  // The segment lives in the route, so another tab can open a given list (⑭ opens ①).
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>();
  const scope: Scope = scopeParam === 'parts' ? 'parts' : 'whole';
  // The make tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  // The header and segment float over the grid; measure them so larger text never overlaps it.
  const [headerHeight, setHeaderHeight] = useState(48);
  const [segmentHeight, setSegmentHeight] = useState(52);
  const contentTop = insets.top + 16 + headerHeight;
  // The grids scroll under the tab bar, which the bottom safe-area inset includes.
  const contentBottom = insets.bottom + 24;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      {scope === 'whole' ? (
        <RecipeGrid top={contentTop} bottom={contentBottom} />
      ) : (
        <PartGrid top={contentTop + segmentHeight + 27} bottom={contentBottom} />
      )}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: contentTop + 6,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.96) 72%, rgba(255,255,255,0) 100%)',
        }}
      />
      <Header top={insets.top} onHeight={setHeaderHeight} />
      <View
        className="absolute inset-x-0 items-center"
        style={{ top: contentTop }}
        onLayout={(event) => {
          setSegmentHeight(event.nativeEvent.layout.height);
        }}
      >
        <ScopeSegment
          value={scope}
          onChange={(value) => {
            router.setParams({ scope: value });
          }}
        />
      </View>
    </View>
  );
}

function Header({ top, onHeight }: { top: number; onHeight: (height: number) => void }) {
  const secondary = useTokenColor('--color-ink-secondary');
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View
      className="absolute inset-x-0 gap-1 px-4"
      style={{ top: top + 6 }}
      onLayout={(event) => {
        onHeight(event.nativeEvent.layout.height);
      }}
    >
      <View className="flex-row items-center gap-3">
        <Text className="font-maru-black text-display text-accent-rose">nuri</Text>
        <View className="min-h-12 flex-1 flex-row items-center gap-2 rounded-full border border-black bg-white/55 py-1.5 pl-3.5 pr-1.5">
          {/* The field opens the search screen, which owns the text input. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="メイクを検索"
            // The pill's padding extends the hit area to its 48pt height.
            hitSlop={6}
            onPress={() => {
              router.push('/search');
            }}
            className="min-h-9 flex-1 flex-row items-center gap-2 active:opacity-70"
          >
            <SocialIcon name={SEARCH} webGlyph="⌕" size={22} color={ink} />
            <Text className="flex-1 font-maru text-ui text-ink-secondary" numberOfLines={1}>
              メイクを検索
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="動画URLからレシピを作る（準備中）"
            // The 36pt chip keeps Plan A's look; the slop extends the hit area to 48pt.
            hitSlop={6}
            onPress={() => {
              router.push('/import');
            }}
            className="min-h-9 flex-row items-center gap-1 rounded-full bg-neutral-soft pl-2.5 pr-3 active:opacity-70"
          >
            <SocialIcon name={LINK} webGlyph="↗" size={16} color={secondary} />
            <Text className="font-maru-bold text-label text-ink-primary">動画URL</Text>
          </Pressable>
        </View>
      </View>
      <OpenNativeAppLink />
    </View>
  );
}

function ScopeSegment({ value, onChange }: { value: Scope; onChange: (value: Scope) => void }) {
  const options: { value: Scope; label: string; caption: string }[] = [
    { value: 'whole', label: '全体', caption: '顔まるごと' },
    { value: 'parts', label: '部位', caption: 'パーツ別' },
  ];
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row rounded-control bg-home-switch-track p-1"
      style={{ boxShadow: '0px 8px 12px rgba(196, 61, 112, 0.14)' }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            // The 44pt pill keeps Plan A's look; the segment padding extends the hit area to 52pt.
            hitSlop={4}
            onPress={() => {
              onChange(option.value);
            }}
            className={cn(
              'min-h-11 w-26 items-center justify-center rounded-control-compact',
              selected && 'bg-bg-surface',
            )}
          >
            <Text
              className={cn(
                'font-maru-bold text-label',
                selected ? 'text-ink-primary' : 'text-ink-secondary',
              )}
            >
              {option.label}
            </Text>
            <Text className="font-maru-bold text-micro text-ink-secondary">{option.caption}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecipeGrid({ top, bottom }: { top: number; bottom: number }) {
  const list = useInfiniteQuery({ ...recipeListOptions(), enabled: Boolean(apiUrl) });
  const status = !apiUrl ? (
    <Feedback message="接続先が未設定です。セットアップ後にレシピを表示できます。" />
  ) : list.isPending ? (
    <Feedback loading message="レシピを読み込んでいます" />
  ) : list.isError ? (
    <Feedback
      message="レシピを読み込めませんでした。通信状況を確認してお試しください。"
      onRetry={() => {
        void list.refetch();
      }}
    />
  ) : null;
  return (
    <RecipeList
      query={list}
      status={status}
      emptyMessage="レシピはまだありません"
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom, gap: 14 }}
      contentInsetAdjustmentBehavior="never"
    />
  );
}

function PartGrid({ top, bottom }: { top: number; bottom: number }) {
  const counts = useQuery({ ...recipePartsOptions, enabled: Boolean(apiUrl) });
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom, paddingHorizontal: 16 }}
    >
      <View className="flex-row flex-wrap gap-3">
        {partCards.map((card) => (
          <PartCard
            key={card.part}
            card={card}
            // Unknown while loading or offline; the card still opens the list, which explains.
            count={
              counts.data
                ? (counts.data.find((item) => item.part === card.part)?.count ?? 0)
                : undefined
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

function PartCard({
  card,
  count,
}: {
  card: (typeof partCards)[number];
  count: number | undefined;
}) {
  const part = parts[card.part];
  const countLabel = count === undefined ? '' : `${count}レシピ`;
  const label = countLabel ? `${part.label}、${countLabel}` : part.label;
  const className =
    'h-31 grow basis-2/5 justify-end overflow-hidden rounded-3xl border-2 border-white p-2';
  const style = { boxShadow: '0px 4px 14px rgba(196, 61, 112, 0.1)' };
  const content = (
    <>
      <CroppedPhoto source={card.photo} crop={card.crop} opacity={card.dimmed ? 0.8 : 1} />
      <View
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(109,109,109,0.3))',
        }}
      />
      <View className="flex-row items-center gap-1.75 self-start rounded-card border border-white bg-white/80 py-1.25 pl-1.25 pr-3">
        <View
          className={cn('size-7.5 items-center justify-center rounded-full', part.iconBackground)}
        >
          <Image accessible={false} source={part.icon} style={{ width: 18, height: 18 }} />
        </View>
        <View>
          <Text className="font-maru-bold text-label text-ink-primary">{part.label}</Text>
          {countLabel ? (
            <Text className="font-maru-bold text-micro text-ink-secondary">{countLabel}</Text>
          ) : null}
        </View>
      </View>
    </>
  );
  // A part without recipes has no list to open.
  if (count === 0) {
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}（準備中）`}
        accessibilityState={{ disabled: true }}
        className={className}
        style={style}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(className, 'active:opacity-80')}
      style={style}
      onPress={() => {
        router.push(`/parts/${card.part}`);
      }}
    >
      {content}
    </Pressable>
  );
}
