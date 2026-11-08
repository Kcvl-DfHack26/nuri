import { Icon } from '@expo/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BrowShape, DiagnosisResult, FaceType } from '@/lib/face-diagnosis';
import type { RecipeSummary } from '@/lib/recipes';

import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { ProfilePhoto } from '@/components/my-page';
import { parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiAssetUrl, apiUrl } from '@/lib/api';
import { browShapes, eyeShapes, faceTypes, midfaces, readResultParams } from '@/lib/face-diagnosis';
import { backOrHome } from '@/lib/navigation';
import { formatCount, recipeListOptions } from '@/lib/recipes';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import balanceDiagram from '../../assets/plan-a/diagnosis/balance.svg';
import contourDiagram from '../../assets/plan-a/diagnosis/contour.svg';
import eyeTiltDiagram from '../../assets/plan-a/diagnosis/eye-tilt.svg';
import sparkleRose from '../../assets/plan-a/icons/sparkle-rose.svg';

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

// Why the suited brow helps, shown on the brow row.
const browAdvice: Record<BrowShape, string> = {
  arch: '眉山に高さを出してすっきり見せます',
  straight: '横のラインで縦の長さをやわらげます',
  softArch: 'ゆるやかなカーブで自然に整えます',
  rising: '眉尻を上げてきりっと見せます',
  falling: '眉尻を下げてやさしく見せます',
};

// Plan A ⑭ 診断結果・おすすめメイク.
export function Diagnosis() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const pink = useTokenColor('--color-pastel-pink');
  const peach = useTokenColor('--color-base-peach');
  const result = readResultParams(useLocalSearchParams());
  // The header floats over the feed; measure it so larger text never covers the first card.
  const [headerHeight, setHeaderHeight] = useState(44);
  // iOS insets the tab's first ScrollView for the status bar and tab bar; Android adds both here.
  const scrollTop = Platform.OS === 'ios' ? 0 : insets.top;
  const scrollBottom = Platform.OS === 'ios' ? 0 : insets.bottom;
  const faceType = result ? faceTypes[result.faceType] : undefined;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6"
        contentContainerStyle={{
          paddingTop: scrollTop + headerHeight + 12,
          paddingBottom: scrollBottom + 28,
        }}
      >
        {result && faceType ? (
          <>
            <View
              className="mx-4 flex-row items-center gap-3.5 rounded-3xl p-4"
              style={{ backgroundImage: `linear-gradient(to right, ${pink}, ${peach})` }}
            >
              {result.photo ? (
                <Image
                  accessible={false}
                  source={{ uri: result.photo }}
                  contentFit="cover"
                  style={{ width: 68, height: 68, borderRadius: 34 }}
                />
              ) : (
                <ProfilePhoto size={68} />
              )}
              <View className="flex-1 items-start gap-1">
                <Text className="font-maru text-meta text-ink-secondary">あなたの顔タイプ</Text>
                <Text
                  accessibilityRole="header"
                  className="font-maru-bold text-headline text-ink-primary"
                >
                  {faceType.label}
                </Text>
                <Text className="font-maru-bold text-label text-ink-primary">
                  {eyeShapes[result.eye].label}・{midfaces[result.midface].label}
                </Text>
              </View>
            </View>
            <Basis result={result} />
            <View className="mx-4 gap-2.5">
              <View className="gap-0.5 pl-1">
                <Text
                  accessibilityRole="header"
                  className="font-maru-bold text-heading text-ink-primary"
                >
                  部位ごとの診断
                </Text>
                <Text className="font-maru text-meta text-ink-secondary">
                  ほかの部位の診断は準備中です
                </Text>
              </View>
              <BrowCard current={result.brow} suited={faceType.suitedBrow} />
            </View>
            <Recommendations faceType={result.faceType} />
          </>
        ) : (
          <View className="mx-5">
            <Feedback message="まだ診断していません。提案のタブで写真を撮るか選んでください" />
          </View>
        )}
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

// Enough cards to swipe through; all fit in the first page of the recipe list.
const recommendationCount = 10;

// Recipes tagged for this face type come first; the rest of the newest recipes fill the row.
function Recommendations({ faceType }: { faceType: FaceType }) {
  const list = useInfiniteQuery({ ...recipeListOptions(), enabled: Boolean(apiUrl) });
  const tag = `${faceTypes[faceType].label}向け`;
  const items = list.data?.pages[0]?.items ?? [];
  const recipes = [
    ...items.filter((recipe) => recipe.tags.includes(tag)),
    ...items.filter((recipe) => !recipe.tags.includes(tag)),
  ].slice(0, recommendationCount);
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between px-5">
        <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
          おすすめメイク!!
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="おすすめメイクをすべて見る"
          className="min-h-12 justify-center pl-3 active:opacity-70"
          onPress={() => {
            // ① lists every whole-face recipe, newest first, even if the parts list was left open.
            router.navigate({ pathname: '/', params: { scope: 'whole' } });
          }}
        >
          <Text className="font-maru-bold text-label text-accent-rose">すべて見る</Text>
        </Pressable>
      </View>
      {!apiUrl ? (
        <View className="px-5">
          <Feedback message="接続先が未設定です。セットアップ後におすすめを表示できます。" />
        </View>
      ) : list.isPending ? (
        <View className="px-5">
          <Feedback loading message="おすすめを読み込んでいます" />
        </View>
      ) : list.isError ? (
        <View className="px-5">
          <Feedback
            message="おすすめを読み込めませんでした。通信状況を確認してお試しください。"
            onRetry={() => {
              void list.refetch();
            }}
          />
        </View>
      ) : recipes.length === 0 ? (
        <View className="px-5">
          <Feedback message="おすすめできるレシピはまだありません" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2.5 px-4"
        >
          {recipes.map((recipe) => (
            <RecommendationCard
              key={recipe.id}
              recipe={recipe}
              matched={recipe.tags.includes(tag) ? tag : undefined}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Why each result was given: its definition. The numbers behind them are provisional (#47).
function Basis({ result }: { result: DiagnosisResult }) {
  const rows = [
    {
      ...faceTypes[result.faceType],
      category: '輪郭',
      diagram: contourDiagram,
      background: 'bg-pastel-pink',
    },
    {
      ...eyeShapes[result.eye],
      category: '目の傾き',
      diagram: eyeTiltDiagram,
      background: 'bg-pastel-lilac',
    },
    {
      ...midfaces[result.midface],
      label: `${midfaces[result.midface].label}（目安）`,
      category: '顔のバランス',
      diagram: balanceDiagram,
      background: 'bg-pastel-peach',
    },
  ];
  return (
    <View className="mx-4 gap-4 px-1">
      <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
        あなたの顔の特徴
      </Text>
      {rows.map((row) => (
        <View key={row.category} className="min-h-21 flex-row items-center gap-3.5">
          <View
            className={cn(
              'size-18 shrink-0 overflow-hidden rounded-control-compact',
              row.background,
            )}
          >
            <Image accessible={false} source={row.diagram} style={{ width: 72, height: 72 }} />
          </View>
          <View className="flex-1 gap-0.75">
            <Text className="font-maru text-meta text-ink-secondary">{row.category}</Text>
            <Text className="font-maru-bold text-heading text-ink-primary">{row.label}</Text>
            <Text className="font-maru text-meta text-ink-secondary">{row.basis}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BrowCard({ current, suited }: { current: BrowShape | null; suited: BrowShape }) {
  const [open, setOpen] = useState(true);
  const ink = useTokenColor('--color-ink-primary');
  const summary = browAdvice[suited];
  return (
    <View className="overflow-hidden rounded-card border-fine border-line-soft bg-bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`眉、${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
        }}
        className="min-h-12 flex-row items-center gap-3 py-2.5 pl-2.5 pr-3 active:opacity-70"
      >
        <View className="size-9.5 items-center justify-center rounded-full bg-pastel-peach">
          <Image accessible={false} source={parts.brow.icon} style={{ width: 20, height: 20 }} />
        </View>
        <View className="flex-1 gap-px">
          <Text className="font-maru-bold text-label text-ink-primary">眉</Text>
          <Text className="font-maru text-meta text-ink-secondary">{summary}</Text>
        </View>
        <SocialIcon name={open ? COLLAPSE : EXPAND} size={22} color={ink} />
      </Pressable>
      {open ? (
        <View className="gap-3 px-3.5 pb-3.5">
          <View className="flex-row gap-2">
            {[
              {
                label: '今の眉',
                value: current ? browShapes[current] : '判定できませんでした',
                background: 'bg-bg-base',
              },
              { label: '似合う形', value: browShapes[suited], background: 'bg-pastel-peach' },
            ].map((stat) => (
              <View
                key={stat.label}
                accessible
                className={cn('flex-1 gap-0.5 rounded-thumbnail px-3 py-2.5', stat.background)}
              >
                <Text className="font-maru text-meta text-ink-secondary">{stat.label}</Text>
                <Text className="font-maru-bold text-label text-ink-primary">{stat.value}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push('/parts/brow');
            }}
            className="min-h-12 flex-row items-center justify-center gap-1 rounded-3xl border border-black px-4 active:opacity-70"
          >
            <Text className="font-maru-bold text-label text-ink-primary">眉のメイクを見る</Text>
            <SocialIcon name={NEXT} size={18} color={ink} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RecommendationCard({
  recipe,
  matched,
}: {
  recipe: RecipeSummary;
  matched: string | undefined;
}) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const likes = formatCount(recipe.likeCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[recipe.title, recipe.author.name, matched].filter(Boolean).join('、')}
      className="w-43 gap-1.25 active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      <View className="h-45 w-full overflow-hidden rounded-card bg-neutral-soft">
        <Image
          accessible={false}
          source={{ uri: apiAssetUrl(recipe.image) }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        {matched ? (
          <View
            className="absolute left-2 top-2 flex-row items-center gap-1.25 rounded-2xl border border-white bg-white/85 py-1.5 pl-2 pr-3"
            style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
          >
            <Image accessible={false} source={sparkleRose} style={{ width: 12, height: 12 }} />
            <Text className="font-maru-bold text-micro text-accent-rose">{matched}</Text>
          </View>
        ) : null}
        <View className="absolute bottom-2 right-2 size-7.5 items-center justify-center rounded-full bg-white/85">
          <SocialIcon name={HEART} size={16} color={ink} />
        </View>
      </View>
      <View className="w-full gap-px px-1 pt-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        <View className="flex-row items-center gap-0.75">
          <Text className="flex-1 font-maru text-meta text-ink-secondary">
            {recipe.author.name}
          </Text>
          <SocialIcon name={HEART} size={13} color={secondary} />
          <Text className="font-maru text-meta text-ink-secondary">{likes}</Text>
        </View>
      </View>
    </Pressable>
  );
}
