import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Recipe } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { partCards, parts, recipes } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const SEARCH = Icon.select({
  ios: 'magnifyingglass',
  android: import('@expo/material-symbols/search.xml'),
});
const LINK = Icon.select({ ios: 'link', android: import('@expo/material-symbols/link.xml') });
const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

type Scope = 'whole' | 'parts';

// Plan A ① ホーム（全体メイク） and ② ホーム（部位メイク）.
export function Home() {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope>('whole');
  const contentTop = insets.top + 64;
  return (
    <View className="flex-1 bg-white">
      {scope === 'whole' ? <RecipeGrid top={contentTop} /> : <PartGrid top={contentTop + 79} />}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: contentTop + 6,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.96) 72%, rgba(255,255,255,0) 100%)',
        }}
      />
      <Header top={insets.top} />
      <View className="absolute inset-x-0 items-center" style={{ top: contentTop }}>
        <ScopeSegment value={scope} onChange={setScope} />
      </View>
    </View>
  );
}

function Header({ top }: { top: number }) {
  const secondary = useTokenColor('--color-ink-secondary');
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="absolute inset-x-0 flex-row items-center gap-3 px-4" style={{ top: top + 6 }}>
      <Text className="font-maru-black text-display text-accent-rose">nuri</Text>
      {/* Search and SNS import arrive with ③④; keep the Plan A entry point visible but inactive. */}
      <View
        accessible
        accessibilityLabel="メイクを検索（準備中）"
        accessibilityState={{ disabled: true }}
        className="min-h-12 flex-1 flex-row items-center gap-2 rounded-full border border-black bg-white/55 py-1.5 pl-3.5 pr-1.5"
      >
        <SocialIcon name={SEARCH} size={22} color={ink} />
        <Text className="flex-1 font-maru text-ui text-ink-secondary" numberOfLines={1}>
          メイクを検索
        </Text>
        <View className="min-h-9 flex-row items-center gap-1 rounded-full bg-neutral-soft pl-2.5 pr-3">
          <SocialIcon name={LINK} size={16} color={secondary} />
          <Text className="font-maru-bold text-label text-ink-primary">動画URL</Text>
        </View>
      </View>
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
      className="flex-row rounded-[26px] bg-[rgba(216,216,216,0.6)] p-1"
      style={{ boxShadow: '0px 8px 12px rgba(196, 61, 112, 0.14)' }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
            }}
            className={cn(
              'min-h-11 w-[104px] items-center justify-center rounded-[22px]',
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

function RecipeGrid({ top }: { top: number }) {
  return (
    <FlatList
      data={recipes}
      keyExtractor={(recipe) => recipe.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 6 }}
      contentContainerStyle={{ paddingTop: top, paddingBottom: 24, gap: 14 }}
      contentInsetAdjustmentBehavior="never"
      renderItem={({ item }) => <RecipeCard recipe={item} />}
    />
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const secondary = useTokenColor('--color-ink-secondary');
  const ink = useTokenColor('--color-ink-primary');
  const content = (
    <>
      <View className="aspect-[192/233] w-full overflow-hidden rounded-[5px]">
        <Image
          accessible={false}
          source={recipe.thumbnail}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        <View className="absolute right-2 top-2 size-8 items-center justify-center rounded-full bg-white">
          <SocialIcon name={HEART} size={18} color={ink} />
        </View>
      </View>
      <View className="w-full gap-[5px] px-2">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="flex-1 font-maru text-meta text-ink-secondary">{recipe.author}</Text>
          <SocialIcon name={HEART} size={14} color={secondary} />
          <Text className="font-maru text-meta text-ink-secondary">{recipe.likes}</Text>
        </View>
      </View>
    </>
  );
  // Only recipes with Plan A detail screens open ⑤; the rest are catalog previews.
  if (!recipe.detail) {
    return (
      <View
        accessible
        accessibilityLabel={`${recipe.title}、${recipe.author}`}
        className="flex-1 gap-[5px]"
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}、${recipe.author}`}
      className="flex-1 gap-[5px] active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      {content}
    </Pressable>
  );
}

function PartGrid({ top }: { top: number }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: top, paddingBottom: 24, paddingHorizontal: 16 }}
    >
      <View className="flex-row flex-wrap gap-3">
        {partCards.map((card) => {
          const part = parts[card.part];
          return (
            <View
              key={card.part}
              accessible
              accessibilityLabel={`${part.label}、${card.recipeCount}レシピ`}
              className="h-[124px] grow basis-[40%] justify-end overflow-hidden rounded-3xl border-2 border-white p-2"
              style={{ boxShadow: '0px 4px 14px rgba(196, 61, 112, 0.1)' }}
            >
              <CroppedPhoto source={card.photo} crop={card.crop} opacity={card.dimmed ? 0.8 : 1} />
              <View
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(109,109,109,0.3))',
                }}
              />
              <View className="flex-row items-center gap-[7px] self-start rounded-[18px] border border-white bg-white/80 py-[5px] pl-[5px] pr-3">
                <View
                  className={cn(
                    'size-[30px] items-center justify-center rounded-full',
                    part.iconBackground,
                  )}
                >
                  <Image accessible={false} source={part.icon} style={{ width: 18, height: 18 }} />
                </View>
                <View>
                  <Text className="font-maru-bold text-label text-ink-primary">{part.label}</Text>
                  <Text className="font-maru-bold text-micro text-ink-secondary">
                    {card.recipeCount}レシピ
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
