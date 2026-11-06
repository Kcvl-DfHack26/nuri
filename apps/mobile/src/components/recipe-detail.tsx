import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop, Product, Recipe } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { GlassIconButton } from '@/components/glass-icon-button';
import { arPhotos, findRecipe, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import guideBrow from '../../assets/plan-a/detail/guide-brow.svg';
import guideCheek from '../../assets/plan-a/detail/guide-cheek.svg';
import guideFace from '../../assets/plan-a/detail/guide-face.svg';
import guideShading from '../../assets/plan-a/detail/guide-shading.svg';
import sparkleWhite from '../../assets/plan-a/icons/sparkle-white.svg';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/ios_share.xml'),
});
const BOOKMARK = Icon.select({
  ios: 'bookmark',
  android: import('@expo/material-symbols/bookmark.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});
const CART = Icon.select({
  ios: 'cart',
  android: import('@expo/material-symbols/shopping_cart.xml'),
});
const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

// Hero layout from Plan A ⑤ (390×540 frame). The guides and pins were drawn on its top 480pt.
const heroCrop: PhotoCrop = {
  width: '120.64%',
  height: '154.82%',
  left: '-12.18%',
  top: '-13.89%',
};
const pins = [
  { x: 251, y: 177 },
  { x: 101, y: 211 },
  { x: 281, y: 227 },
  { x: 75, y: 341 },
  { x: 271, y: 281 },
  { x: 203, y: 381 },
];
const pinLabels = [
  { x: 272, y: 160 },
  { x: 14, y: 186 },
  { x: 302, y: 228 },
  { x: 10, y: 370 },
  { x: 290, y: 306 },
  { x: 236, y: 404 },
];
const atFrame = (x: number, y: number) =>
  ({ left: `${(x / 390) * 100}%`, top: `${(y / 540) * 100}%` }) as const;

// Plan A ⑤ レシピ詳細.
export function RecipeDetail({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const recipe = findRecipe(id);
  if (!recipe?.detail) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="font-maru-bold text-heading text-ink-primary">レシピが見つかりません</Text>
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
  const { detail } = recipe;
  // Plan A keeps the face and the sheet in place; only the sheet's content scrolls.
  const heroHeight = (window.width * 540) / 390;
  // Wide or short windows (iPad, landscape) keep Plan A's share of the screen for the sheet.
  const sheetTop = Math.min(heroHeight - 50, window.height * (490 / 844));
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <View className="absolute inset-x-0 top-0">
        <Hero recipe={recipe} />
      </View>
      <View
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white"
        style={{ top: sheetTop, boxShadow: '0px -6px 24px rgba(196, 61, 112, 0.1)' }}
      >
        <ScrollView
          className="rounded-t-[28px]"
          contentInsetAdjustmentBehavior="never"
          contentContainerClassName="gap-3 px-5 pt-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        >
          <View className="gap-2">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-headline text-ink-primary"
            >
              {recipe.title}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {detail.tags.map((tag) => (
                <View
                  key={tag.label}
                  className={cn('min-h-6 justify-center rounded-xl px-2.5', tag.background)}
                >
                  <Text className="font-maru-bold text-micro text-ink-primary">{tag.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Image
              accessible={false}
              source={detail.avatar}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
            <View className="flex-1">
              <Text className="font-maru-bold text-label text-ink-primary">{recipe.author}</Text>
              <Text className="font-maru text-meta text-ink-secondary">{detail.source}</Text>
            </View>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="フォロー（準備中）"
              accessibilityState={{ disabled: true }}
              className="min-h-8 justify-center rounded-full border border-accent-rose bg-white px-4"
            >
              <Text className="font-maru-bold text-label text-accent-rose">フォロー</Text>
            </View>
          </View>
          <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
            手順
          </Text>
          <View className="flex-row justify-between">
            {detail.overview.map((partId, index) => {
              const part = parts[partId];
              return (
                <View key={partId} className="items-center gap-1">
                  <View
                    className={cn(
                      'size-[46px] items-center justify-center rounded-full',
                      part.iconBackground,
                    )}
                  >
                    <Image
                      accessible={false}
                      source={part.icon}
                      style={{ width: 22, height: 22 }}
                    />
                    <View className="absolute -top-0.5 left-[30px] size-[18px] items-center justify-center rounded-full border-[1.5px] border-white bg-accent-rose">
                      <Text className="font-maru-bold text-micro text-white">{index + 1}</Text>
                    </View>
                  </View>
                  <Text className="font-maru-bold text-micro text-ink-primary">
                    {partId === 'eye'
                      ? 'シャドウ'
                      : partId === 'lash'
                        ? 'ライン'
                        : partId === 'shading'
                          ? 'シェード'
                          : part.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row items-center justify-between">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-heading text-ink-primary"
            >
              使うメイク品
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">{detail.productCount}点</Text>
          </View>
          {detail.products.map((product) => (
            <ProductRow key={product.name} product={product} />
          ))}
        </ScrollView>
      </View>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-[110px]"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0))',
        }}
      />
      <View
        className="absolute inset-x-4 flex-row items-center gap-2"
        style={{ top: insets.top + 6 }}
      >
        <GlassIconButton
          icon={BACK}
          label="戻る"
          onPress={() => {
            backOrHome();
          }}
        />
        <View className="flex-1" />
        <GlassIconButton
          icon={SHARE}
          label="共有"
          onPress={() => {
            void Share.share({
              message: `${recipe.title}（${recipe.author}）をnuriで見つけました`,
            }).catch(() => undefined);
          }}
        />
        <GlassIconButton icon={BOOKMARK} label="保存（準備中）" />
      </View>
      <BottomBar recipeId={recipe.id} bottom={insets.bottom} />
    </View>
  );
}

function Hero({ recipe }: { recipe: Recipe }) {
  const overview = recipe.detail?.overview ?? [];
  return (
    <View className="aspect-[390/540] w-full overflow-hidden">
      <CroppedPhoto source={arPhotos.finished} crop={heroCrop} />
      {[guideFace, guideCheek, guideShading, guideBrow].map((guide, index) => (
        <Image
          // Guides are a fixed set of static assets.
          key={index}
          accessible={false}
          source={guide}
          contentFit="fill"
          style={{ position: 'absolute', width: '100%', height: `${(480 / 540) * 100}%` }}
        />
      ))}
      {pins.map((pin, index) => (
        <View
          key={`pin-${pin.x}-${pin.y}`}
          className="absolute size-[22px] items-center justify-center rounded-full bg-white/95"
          style={{ ...atFrame(pin.x, pin.y), boxShadow: '0px 2px 6px rgba(196, 61, 112, 0.25)' }}
        >
          <View className="size-2.5 rounded-full bg-accent-rose" />
        </View>
      ))}
      {overview.map((partId, index) => {
        const label = pinLabels[index];
        if (!label) {
          return null;
        }
        return (
          <View
            key={partId}
            className="absolute flex-row items-center gap-[5px] rounded-[14px] border border-white bg-white/80 py-[3px] pl-[3px] pr-2.5"
            style={{
              ...atFrame(label.x, label.y),
              boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)',
            }}
          >
            <View className="size-5 items-center justify-center rounded-full bg-accent-rose">
              <Text className="font-maru-bold text-micro text-white">{index + 1}</Text>
            </View>
            <Text className="font-maru-bold text-micro text-ink-primary">
              {recipe.detail?.steps[index]?.label ?? parts[partId].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ProductRow({ product }: { product: Product }) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View
      accessible
      accessibilityLabel={`${product.name}、${product.detail}`}
      className="flex-row items-center gap-3 rounded-[18px] border border-line-soft bg-bg-surface p-2.5"
    >
      <Image
        accessible={false}
        source={product.image}
        style={{ width: 52, height: 52, borderRadius: 14 }}
      />
      <View className="flex-1 gap-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{product.name}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{product.detail}</Text>
      </View>
      {product.purchasable ? (
        <View className="min-h-6 flex-row items-center gap-1 rounded-xl bg-base-peach px-2.5">
          <SocialIcon name={CART} size={12} color={ink} />
          <Text className="font-maru-bold text-micro text-ink-primary">買う</Text>
        </View>
      ) : null}
      <SocialIcon name={NEXT} size={18} color={secondary} />
    </View>
  );
}

function BottomBar({ recipeId, bottom }: { recipeId: string; bottom: number }) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View
      className="absolute inset-x-0 bottom-0 flex-row items-center gap-2.5 bg-[rgba(242,242,242,0.85)] px-4 pt-3"
      style={{ paddingBottom: Math.max(bottom, 12) }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="お気に入り（準備中）"
        accessibilityState={{ disabled: true }}
        className="size-[52px] items-center justify-center rounded-full bg-white"
      >
        <SocialIcon name={HEART} size={22} color={ink} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push(`/recipes/${recipeId}/steps`);
        }}
        className="min-h-[52px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-5 active:opacity-80"
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        <Image accessible={false} source={sparkleWhite} style={{ width: 20, height: 20 }} />
        <Text className="font-maru-bold text-action text-white">メイクをはじめる</Text>
      </Pressable>
    </View>
  );
}
