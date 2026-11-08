import { Icon } from '@expo/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RecipeSummary } from '@/lib/recipes';

import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { isPartId, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { StartBar } from '@/components/start-bar';
import { Text } from '@/components/ui/text';
import { useFavorite } from '@/components/use-favorite';
import { apiAssetUrl, apiUrl } from '@/lib/api';
import { cardGrid, cardGridGap, cardGridInset, useLayoutSize } from '@/lib/layout';
import { backOrHome } from '@/lib/navigation';
import { recipeListOptions } from '@/lib/recipes';
import { cn } from '@/lib/utils';

import sparkleInk from '../../assets/plan-a/icons/sparkle-ink.svg';
import sparkleRose from '../../assets/plan-a/icons/sparkle-rose.svg';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SEARCH = Icon.select({
  ios: 'magnifyingglass',
  android: import('@expo/material-symbols/search.xml'),
});
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});

// Plan A draws these header buttons solid because they sit on white, not on a photo.
const solidButton = 'border-black/8 bg-white';

type StyleFilter = 'round' | 'beginner' | 'natural';

// ③'s filter chips, matched against the recipes' tags. 丸顔向け also marks the card with Plan A's
// 丸顔におすすめ badge.
const styleFilters: { value: StyleFilter; label: string; tag: string }[] = [
  { value: 'round', label: '丸顔におすすめ', tag: '丸顔向け' },
  { value: 'beginner', label: '初心者OK', tag: '初心者OK' },
  { value: 'natural', label: 'ナチュラル', tag: 'ナチュラル' },
];
const roundTag = '丸顔向け';

// Plan A ③ 部位別一覧: the part's recipes from the API. Choosing one and starting opens its ⑤.
export function PartList({ part }: { part: string }) {
  const insets = useSafeAreaInsets();
  const { width, onLayout } = useLayoutSize();
  const { cardWidth } = cardGrid(width);
  const partId = isPartId(part) ? part : undefined;
  const list = useInfiniteQuery({
    ...recipeListOptions(partId ? { part: partId } : {}),
    enabled: Boolean(apiUrl) && partId !== undefined,
  });
  const recipes = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const [filter, setFilter] = useState<StyleFilter | 'all'>('all');
  // The selection survives filter changes so the start button keeps acting on what was chosen.
  const [chosenId, setChosenId] = useState<string>();
  if (!partId) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <StatusBar style="dark" />
        <Text className="font-maru-bold text-heading text-ink-primary">部位が見つかりません</Text>
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className={solidButton}
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
    );
  }
  const tag = styleFilters.find((option) => option.value === filter)?.tag;
  const visible = tag ? recipes.filter((recipe) => recipe.tags.includes(tag)) : recipes;
  const selected = recipes.find((recipe) => recipe.id === chosenId) ?? recipes[0];
  const selectedId = selected?.id;
  const status = listStatus({
    loading: list.isPending,
    onRetry: list.isError
      ? () => {
          void list.refetch();
        }
      : undefined,
    partLabel: parts[partId].label,
    total: recipes.length,
    shown: visible.length,
  });
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 4 }}>
      <StatusBar style="dark" />
      <View className="min-h-11 flex-row items-center gap-2 px-4">
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className={solidButton}
          onPress={() => {
            backOrHome();
          }}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-maru-bold text-heading text-ink-primary"
        >
          {parts[partId].label}
        </Text>
        <GlassIconButton
          icon={SEARCH}
          label={`${parts[partId].label}のレシピを検索（準備中）`}
          className={solidButton}
        />
      </View>
      <FilterChips value={filter} onChange={setFilter} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onLayout={onLayout}
        contentContainerClassName="flex-row flex-wrap gap-y-5.25"
        contentContainerStyle={{
          columnGap: cardGridGap,
          paddingHorizontal: cardGridInset,
          paddingTop: 42,
          paddingBottom: insets.bottom + 96,
        }}
      >
        {status ? <View className="w-full">{status}</View> : null}
        {visible.map((recipe) => (
          <StyleCard
            key={recipe.id}
            recipe={recipe}
            width={cardWidth}
            selected={recipe.id === selectedId}
            onSelect={() => {
              setChosenId(recipe.id);
            }}
          />
        ))}
        {list.hasNextPage ? (
          // Filters only see loaded recipes, so more can be loaded under any filter.
          <LoadMore
            loading={list.isFetchingNextPage}
            onPress={() => {
              void list.fetchNextPage();
            }}
          />
        ) : null}
      </ScrollView>
      {selected ? (
        <SelectedStartBar recipe={selected} bottom={insets.bottom} />
      ) : (
        <StartBar bottom={insets.bottom} />
      )}
    </View>
  );
}

// The heart and the start button act on the chosen style.
function SelectedStartBar({ recipe, bottom }: { recipe: RecipeSummary; bottom: number }) {
  const favorite = useFavorite(recipe);
  return (
    <StartBar
      bottom={bottom}
      favorite={favorite}
      onStart={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    />
  );
}

function FilterChips({
  value,
  onChange,
}: {
  value: StyleFilter | 'all';
  onChange: (value: StyleFilter | 'all') => void;
}) {
  const options: { value: StyleFilter | 'all'; label: string }[] = [
    { value: 'all', label: 'すべて' },
    ...styleFilters.map(({ value, label }) => ({ value, label })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-px grow-0"
      contentContainerClassName="gap-2 px-4"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          // hitSlop cannot reach past the scroll view, so the 48pt target is the pressable
          // itself and the 34pt Plan A chip is drawn inside it.
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
            }}
            className="min-h-12 justify-center active:opacity-80"
          >
            <View
              className={cn(
                // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- Keep the fixed radius of this 34pt filter chip when text wraps.
                'min-h-8.5 flex-row items-center gap-1 rounded-[17px] px-3.5',
                selected ? 'bg-accent-rose' : 'bg-neutral-soft',
              )}
            >
              {option.value === 'round' ? (
                <Image accessible={false} source={sparkleInk} style={{ width: 16, height: 16 }} />
              ) : null}
              <Text
                className={cn(
                  'font-maru-bold text-label',
                  selected ? 'text-white' : 'text-ink-primary',
                )}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StyleCard({
  recipe,
  width,
  selected,
  onSelect,
}: {
  recipe: RecipeSummary;
  width: DimensionValue;
  selected: boolean;
  onSelect: () => void;
}) {
  const recommended = recipe.tags.includes(roundTag);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${recipe.title}${recipe.summary ? `、${recipe.summary}` : ''}${recommended ? '、丸顔におすすめ' : ''}`}
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      className="gap-1 active:opacity-80"
      style={{ width }}
    >
      <View
        className={cn(
          'aspect-175/118 w-full overflow-hidden rounded-2xl bg-neutral-soft',
          selected ? 'border-3 border-accent-rose' : 'border border-black/6',
        )}
      >
        <Image
          accessible={false}
          source={{ uri: apiAssetUrl(recipe.image) }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        {recommended ? (
          <View className="absolute bottom-2.75 left-1.5 flex-row items-center gap-0.75 rounded-xl bg-white/85 py-0.75 pl-1.5 pr-2">
            <Image accessible={false} source={sparkleRose} style={{ width: 12, height: 12 }} />
            <Text className="font-maru-bold text-micro text-accent-rose">丸顔におすすめ</Text>
          </View>
        ) : null}
        {selected ? (
          <View className="absolute bottom-2 right-2 size-6.5 items-center justify-center rounded-full bg-accent-rose">
            <SocialIcon name={CHECK} size={16} color="white" />
          </View>
        ) : null}
      </View>
      <View className="px-1 pt-1">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        {recipe.summary ? (
          <Text className="font-maru text-meta text-ink-secondary">{recipe.summary}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function listStatus({
  loading,
  onRetry,
  partLabel,
  total,
  shown,
}: {
  loading: boolean;
  onRetry: (() => void) | undefined;
  partLabel: string;
  total: number;
  shown: number;
}) {
  if (!apiUrl) {
    return <Feedback message="接続先が未設定です。セットアップ後にレシピを表示できます。" />;
  }
  if (loading) {
    return <Feedback loading message="レシピを読み込んでいます" />;
  }
  if (onRetry) {
    return (
      <Feedback
        message="レシピを読み込めませんでした。通信状況を確認してお試しください。"
        onRetry={onRetry}
      />
    );
  }
  if (total === 0) {
    return <Feedback message={`${partLabel}のレシピはまだありません`} />;
  }
  return shown === 0 ? <Feedback message="条件に合うレシピがありません" /> : null;
}

function LoadMore({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      className="min-h-12 w-full items-center justify-center active:opacity-70"
    >
      <Text className="font-maru-bold text-label text-accent-rose">
        {loading ? '読み込み中…' : 'もっと見る'}
      </Text>
    </Pressable>
  );
}
