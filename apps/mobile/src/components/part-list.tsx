import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PartStyle, StyleFilter } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { GlassIconButton } from '@/components/glass-icon-button';
import { isPartId, parts, partStyles, styleFilters } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { StartBar } from '@/components/start-bar';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
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
const solidButton = 'border-black/[0.08] bg-white';

// Plan A ③ 部位別一覧. Plan A designs the brow list; other parts have no styles yet.
export function PartList({ part }: { part: string }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const list = isPartId(part) ? partStyles[part] : undefined;
  const [filter, setFilter] = useState<StyleFilter | 'all'>('all');
  // Plan A opens with the style that has a recipe (微アーチ眉) selected. The selection
  // survives filter changes so the start button keeps acting on what the user chose.
  const [selectedId, setSelectedId] = useState(list?.styles.find((style) => style.recipeId)?.id);
  if (!isPartId(part) || !list) {
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
  const visible =
    filter === 'all' ? list.styles : list.styles.filter((style) => style.filters.includes(filter));
  const recipeId = list.styles.find((style) => style.id === selectedId)?.recipeId;
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
          {parts[part].label}
        </Text>
        <GlassIconButton
          icon={SEARCH}
          label={`${parts[part].label}のレシピを検索（準備中）`}
          className={solidButton}
        />
      </View>
      <FilterChips value={filter} onChange={setFilter} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="flex-row flex-wrap gap-x-2 gap-y-[21px] px-4"
        contentContainerStyle={{ paddingTop: 42, paddingBottom: insets.bottom + 96 }}
      >
        {visible.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            photo={list.photo}
            // Two columns with an 8pt gutter; a lone filtered card keeps its column width.
            width={Math.floor((window.width - 40) / 2)}
            selected={style.id === selectedId}
            onSelect={() => {
              setSelectedId(style.id);
            }}
          />
        ))}
      </ScrollView>
      <StartBar
        bottom={insets.bottom}
        onStart={
          recipeId
            ? () => {
                router.push(`/recipes/${recipeId}`);
              }
            : undefined
        }
      />
    </View>
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
    ...styleFilters,
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-2 grow-0"
      contentContainerClassName="gap-2 px-4"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            // The 34pt chip keeps Plan A's look; hitSlop extends the target to 48pt.
            hitSlop={{ top: 7, bottom: 7 }}
            onPress={() => {
              onChange(option.value);
            }}
            className={cn(
              'min-h-[34px] flex-row items-center gap-1 rounded-[17px] px-3.5 active:opacity-80',
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
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StyleCard({
  style,
  photo,
  width,
  selected,
  onSelect,
}: {
  style: PartStyle;
  photo: number;
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const recommended = style.filters.includes('round');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${style.name}、${style.caption}${recommended ? '、丸顔におすすめ' : ''}`}
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      className="gap-1 active:opacity-80"
      style={{ width }}
    >
      <View
        className={cn(
          'aspect-[175/118] w-full overflow-hidden rounded-2xl',
          selected ? 'border-[3px] border-accent-rose' : 'border border-black/[0.06]',
        )}
      >
        <CroppedPhoto source={photo} crop={style.crop} />
        {recommended ? (
          <View className="absolute bottom-[11px] left-1.5 flex-row items-center gap-[3px] rounded-xl bg-white/85 py-[3px] pl-1.5 pr-2">
            <Image accessible={false} source={sparkleRose} style={{ width: 12, height: 12 }} />
            <Text className="font-maru-bold text-micro text-accent-rose">丸顔におすすめ</Text>
          </View>
        ) : null}
        {selected ? (
          <View className="absolute bottom-2 right-2 size-[26px] items-center justify-center rounded-full bg-accent-rose">
            <SocialIcon name={CHECK} size={16} color="white" />
          </View>
        ) : null}
      </View>
      <View className="px-1 pt-1">
        <Text className="font-maru-bold text-label text-ink-primary">{style.name}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{style.caption}</Text>
      </View>
    </Pressable>
  );
}
