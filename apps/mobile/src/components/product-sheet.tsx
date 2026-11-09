import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductInfo } from '@/components/recipes';

import { showComingSoon } from '@/components/coming-soon';
import { findProduct } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const CAMERA = Icon.select({
  ios: 'camera',
  android: import('@expo/material-symbols/photo_camera.xml'),
});
const FLASK = Icon.select({ ios: 'flask', android: import('@expo/material-symbols/science.xml') });
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});
const CART = Icon.select({
  ios: 'cart',
  android: import('@expo/material-symbols/shopping_cart.xml'),
});

// Plan A ⑥ 商品詳細ポップアップ, presented as a native form sheet over ⑤. The header and the
// purchase action stay put; the colors and ingredients scroll between them.
export function ProductSheet({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // The sheet fits this height: half the screen as in Plan A, taller when large text needs room.
  const height = Math.min(window.height * 0.5 * Math.max(window.fontScale, 1), window.height * 0.9);
  const product = findProduct(id);
  if (!product?.info) {
    return (
      <View style={{ height }} className="items-center justify-center gap-4 bg-white px-6">
        <Text className="font-maru-bold text-heading text-ink-primary">商品が見つかりません</Text>
        <CloseButton />
      </View>
    );
  }
  const { info } = product;
  return (
    <View style={{ height }} className="bg-white px-5 pt-7.5">
      <View className="flex-row items-center gap-3.5">
        <Image
          accessible={false}
          source={product.image}
          style={{ width: 64, height: 64, borderRadius: 20 }}
        />
        <View className="flex-1 gap-0.5">
          <Text className="font-maru text-meta text-ink-secondary">{info.brand}</Text>
          <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
            {info.title}
          </Text>
          <Text className="font-maru-bold text-label text-accent-rose">{info.price}</Text>
        </View>
        <CloseButton />
      </View>
      {/* On iOS react-native-screens 4.x (tryFindDescendantScrollView) resizes a sheet's ScrollView
          it can find to the whole sheet, which drew the details over the header. This wrapper
          keeps it out of that search; re-check it when upgrading react-native-screens. */}
      <View collapsable={false} className="mt-4 flex-1">
        <ScrollView contentInsetAdjustmentBehavior="never" contentContainerClassName="gap-4 pb-4">
          <ProductDetails info={info} />
        </ScrollView>
      </View>
      <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="購入先を見る（準備中）"
          onPress={() => {
            showComingSoon('購入先の案内');
          }}
          className="min-h-13 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-4.5 active:opacity-80"
          style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
        >
          <SocialIcon name={CART} size={20} color="white" />
          <Text className="font-maru-bold text-action text-white">購入先を見る</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CloseButton() {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="閉じる"
      // The 36pt circle keeps Plan A's look; hitSlop extends the target to 48pt.
      hitSlop={6}
      onPress={() => {
        backOrHome();
      }}
      className="size-9 items-center justify-center rounded-full bg-neutral-soft active:opacity-70"
    >
      <SocialIcon name={CLOSE} webGlyph="×" size={18} color={ink} />
    </Pressable>
  );
}

function ProductDetails({ info }: { info: ProductInfo }) {
  const ink = useTokenColor('--color-ink-primary');
  const rose = useTokenColor('--color-accent-rose');
  const [colorIndex, setColorIndex] = useState(info.initialColor);
  return (
    <>
      <View className="flex-row items-center justify-between gap-2">
        <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
          色
        </Text>
        <Text className="flex-1 text-right font-maru text-meta text-ink-secondary">
          {info.colors[colorIndex]?.name}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
        {info.colors.map((color, index) => {
          const selected = index === colorIndex;
          return (
            <Pressable
              key={color.name}
              accessibilityRole="radio"
              accessibilityLabel={color.name}
              accessibilityState={{ checked: selected }}
              hitSlop={4}
              onPress={() => {
                setColorIndex(index);
              }}
              className={cn(
                'size-10 items-center justify-center rounded-full',
                selected && 'border-selected border-accent-rose',
              )}
            >
              <View className="size-7.5 rounded-full" style={{ backgroundColor: color.hex }} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="自分の顔で色味を見る（準備中）"
        onPress={() => {
          showComingSoon('自分の顔で色味を確かめる機能');
        }}
        className="min-h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-pastel-pink px-4.5 active:opacity-80"
      >
        <SocialIcon name={CAMERA} size={20} color={rose} />
        <Text className="font-maru-bold text-label text-accent-rose">自分の顔で色味を見る</Text>
      </Pressable>
      <View className="h-px bg-line-soft" />
      <View className="flex-row items-center gap-1.5">
        <SocialIcon name={FLASK} size={20} color={ink} />
        <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
          成分
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {info.freeFrom.map((label) => (
          <View
            key={label}
            className="min-h-6.5 flex-row items-center gap-1 rounded-chip bg-pastel-mint px-2.5"
          >
            <SocialIcon name={CHECK} webGlyph="✓" size={12} color={ink} />
            <Text className="font-maru-bold text-micro text-ink-primary">{label}</Text>
          </View>
        ))}
      </View>
      <View className="overflow-hidden rounded-2xl border border-line-soft bg-bg-surface">
        {info.ingredients.map((ingredient, index) => (
          <View
            key={ingredient.name}
            className={cn(
              'flex-row items-center gap-2.5 px-3.5 py-3',
              index < info.ingredients.length - 1 && 'border-b border-line-soft',
            )}
          >
            <View className={cn('size-2.5 rounded-full', ingredient.dot)} />
            <Text className="flex-1 font-maru-bold text-label text-ink-primary">
              {ingredient.name}
            </Text>
            <Text className="shrink font-maru text-meta text-ink-secondary">{ingredient.role}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
