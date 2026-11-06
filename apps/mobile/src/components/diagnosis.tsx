import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PartId, Recipe } from '@/components/recipes';

import { GlassIconButton } from '@/components/glass-icon-button';
import { findRecipe, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import sparkleRose from '../../assets/plan-a/icons/sparkle-rose.svg';
import resultAvatar from '../../assets/plan-a/suggest/avatar.png';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/ios_share.xml'),
});
const EXPAND = Icon.select({
  ios: 'chevron.down',
  android: import('@expo/material-symbols/keyboard_arrow_down.xml'),
});
const COLLAPSE = Icon.select({
  ios: 'chevron.up',
  android: import('@expo/material-symbols/keyboard_arrow_up.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});
const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

type Finding = {
  part: PartId;
  label: string;
  iconBackground: string;
  summary: string;
  /** Only the brow has a designed detail in Plan A; the other rows stay closed. */
  detail?: {
    current: { label: string; value: string };
    suited: { label: string; value: string };
    colors: string[];
    action: string;
  };
};

// Fixed Plan A sample until photo diagnosis exists; nothing is derived from a real photo.
const sample = {
  faceType: '丸顔×イエベ',
  traits: ['たれ目', '中顔面短め'],
  findings: [
    {
      part: 'brow',
      label: '眉',
      iconBackground: 'bg-pastel-peach',
      summary: '眉尻を少し上げると、すっきり見えます',
      detail: {
        current: { label: '今の眉', value: '眉尻がやや下がり気味' },
        suited: { label: '似合う形', value: '少し上げた平行眉' },
        colors: ['#B88F73', '#8A664F', '#6B4D3D', '#4A3330'],
        action: '眉のメイクを見る',
      },
    },
    {
      part: 'eye',
      label: '目元',
      iconBackground: 'bg-pastel-sky',
      summary: '目尻のラインで横幅を出します',
    },
    {
      part: 'cheek',
      label: 'チーク',
      iconBackground: 'bg-pastel-pink',
      summary: '高めに入れると縦のラインが出ます',
    },
    {
      part: 'shading',
      label: 'シェーディング',
      iconBackground: 'bg-pastel-mint',
      summary: 'フェイスラインを細く引き締めます',
    },
    {
      part: 'lip',
      label: 'リップ',
      iconBackground: 'bg-pastel-peach',
      summary: 'コーラル系が肌になじみます',
    },
    {
      part: 'base',
      label: 'ベース',
      iconBackground: 'bg-pastel-butter',
      summary: '明るめのベージュがなじみます',
    },
  ] satisfies Finding[],
  recommendations: [
    { recipeId: 'fox', match: 94 },
    { recipeId: 'round', match: 88 },
    { recipeId: 'cat', match: 81 },
  ],
};

const recommendations = sample.recommendations.flatMap(({ recipeId, match }) => {
  const recipe = findRecipe(recipeId);
  return recipe ? [{ recipe, match }] : [];
});

// Plan A ⑭ 診断結果・おすすめメイク.
export function Diagnosis() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const pink = useTokenColor('--color-pastel-pink');
  const peach = useTokenColor('--color-base-peach');
  // The header floats over the feed; measure it so larger text never covers the first card.
  const [headerHeight, setHeaderHeight] = useState(44);
  // iOS insets the tab's first ScrollView for the status bar and tab bar; Android tabs only
  // pad the tab bar, so the status bar is added here.
  const scrollTop = Platform.OS === 'ios' ? 0 : insets.top;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6"
        contentContainerStyle={{ paddingTop: scrollTop + headerHeight + 12, paddingBottom: 28 }}
      >
        <View
          className="mx-4 flex-row items-center gap-3.5 rounded-3xl p-4"
          style={{ backgroundImage: `linear-gradient(to right, ${pink}, ${peach})` }}
        >
          <Image
            accessible={false}
            source={resultAvatar}
            style={{ width: 68, height: 68, borderRadius: 34 }}
          />
          <View className="flex-1 items-start gap-1">
            <Text className="font-maru text-meta text-ink-secondary">あなたの顔タイプ</Text>
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-headline text-ink-primary"
            >
              {sample.faceType}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {sample.traits.map((trait) => (
                <View
                  key={trait}
                  className="min-h-[22px] justify-center rounded-[11px] bg-white px-2"
                >
                  <Text className="font-maru-bold text-micro text-ink-primary">{trait}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View className="mx-4 gap-2.5">
          <View className="gap-0.5 pl-1">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-heading text-ink-primary"
            >
              部位ごとの診断
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">
              タップすると、くわしく見られます
            </Text>
          </View>
          <View className="gap-2">
            {sample.findings.map((finding) => (
              <FindingCard key={finding.part} finding={finding} />
            ))}
          </View>
        </View>
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between px-5">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-heading text-ink-primary"
            >
              おすすめメイク!!
            </Text>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="おすすめメイクをすべて見る（準備中）"
              accessibilityState={{ disabled: true }}
            >
              <Text className="font-maru-bold text-label text-accent-rose">すべて見る</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2.5 px-4"
          >
            {recommendations.map(({ recipe, match }) => (
              <RecommendationCard key={recipe.id} recipe={recipe} match={match} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insets.top + headerHeight + 20,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.97) 82%, rgba(255,255,255,0) 100%)',
        }}
      />
      <View
        className="absolute inset-x-4 min-h-11 flex-row items-center gap-2"
        style={{ top: insets.top }}
        onLayout={(event) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      >
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className="border-black/8 bg-white"
          onPress={() => {
            backOrHome();
          }}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-maru-bold text-heading text-ink-primary"
        >
          診断結果
        </Text>
        <GlassIconButton
          icon={SHARE}
          label="診断結果を共有（準備中）"
          className="border-black/8 bg-white"
        />
      </View>
    </View>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(true);
  const ink = useTokenColor('--color-ink-primary');
  const { detail } = finding;
  const row = (expanded: boolean) => (
    <>
      <View
        className={cn(
          'size-[38px] items-center justify-center rounded-full',
          finding.iconBackground,
        )}
      >
        <Image
          accessible={false}
          source={parts[finding.part].icon}
          style={{ width: 20, height: 20 }}
        />
      </View>
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{finding.label}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{finding.summary}</Text>
      </View>
      <SocialIcon name={expanded ? COLLAPSE : EXPAND} size={22} color={ink} />
    </>
  );
  const rowClassName = 'min-h-12 flex-row items-center gap-3 py-2.5 pl-2.5 pr-3';
  const label = `${finding.label}、${finding.summary}`;
  return (
    <View className="overflow-hidden rounded-[18px] border-[1.5px] border-line-soft bg-bg-surface">
      {detail ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            setOpen((current) => !current);
          }}
          className={cn(rowClassName, 'active:opacity-70')}
        >
          {row(open)}
        </Pressable>
      ) : (
        // Details for these parts need a real diagnosis; keep the Plan A row but disabled.
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${label}（準備中）`}
          accessibilityState={{ disabled: true, expanded: false }}
          className={rowClassName}
        >
          {row(false)}
        </View>
      )}
      {detail && open ? (
        <View className="gap-3 px-3.5 pb-3.5">
          <View className="flex-row gap-2">
            {[
              { stat: detail.current, background: 'bg-bg-base' },
              { stat: detail.suited, background: 'bg-pastel-peach' },
            ].map(({ stat, background }) => (
              <View
                key={stat.label}
                accessible
                className={cn('flex-1 gap-0.5 rounded-[14px] px-3 py-2.5', background)}
              >
                <Text className="font-maru text-meta text-ink-secondary">{stat.label}</Text>
                <Text className="font-maru-bold text-label text-ink-primary">{stat.value}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-maru text-meta text-ink-secondary">おすすめの色</Text>
            {detail.colors.map((color) => (
              <View
                key={color}
                className="size-6 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${detail.action}（準備中）`}
            accessibilityState={{ disabled: true }}
            className="min-h-11 flex-row items-center justify-center gap-1 rounded-[22px] border border-black px-4"
          >
            <Text className="font-maru-bold text-label text-ink-primary">{detail.action}</Text>
            <SocialIcon name={NEXT} size={18} color={ink} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RecommendationCard({ recipe, match }: { recipe: Recipe; match: number }) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const content = (
    <>
      <View className="h-[180px] w-full overflow-hidden rounded-[18px]">
        <Image
          accessible={false}
          source={recipe.thumbnail}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        <View
          className="absolute left-2 top-2 flex-row items-center gap-[5px] rounded-2xl border border-white bg-white/85 py-1.5 pl-2 pr-3"
          style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
        >
          <Image accessible={false} source={sparkleRose} style={{ width: 12, height: 12 }} />
          <Text className="font-maru-bold text-micro text-accent-rose">相性 {match}%</Text>
        </View>
        <View className="absolute bottom-2 right-2 size-[30px] items-center justify-center rounded-full bg-white/85">
          <SocialIcon name={HEART} size={16} color={ink} />
        </View>
      </View>
      <View className="w-full gap-px px-1 pt-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        <View className="flex-row items-center gap-[3px]">
          <Text className="flex-1 font-maru text-meta text-ink-secondary">{recipe.author}</Text>
          <SocialIcon name={HEART} size={13} color={secondary} />
          <Text className="font-maru text-meta text-ink-secondary">{recipe.likes}</Text>
        </View>
      </View>
    </>
  );
  const label = `${recipe.title}、${recipe.author}、相性${match}%`;
  // Only recipes with Plan A detail screens open ⑤; the rest are catalog previews.
  if (!recipe.detail) {
    return (
      <View accessible accessibilityLabel={label} className="w-[172px] gap-[5px]">
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-[172px] gap-[5px] active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      {content}
    </Pressable>
  );
}
