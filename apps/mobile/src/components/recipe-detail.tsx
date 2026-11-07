import type { AccessibilityActionEvent } from 'react-native';

import { Icon } from '@expo/ui';
import { purchaseUrlSchema } from '@starter/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { openBrowserAsync } from 'expo-web-browser';
import { Fragment } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PartId, PhotoCrop } from '@/components/recipes';
import type { RecipeDetail as RecipeData, RecipeStep } from '@/lib/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { ProfilePhoto } from '@/components/my-page';
import { arPhotos, findProduct, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { StartBar } from '@/components/start-bar';
import { Text } from '@/components/ui/text';
import { apiAssetUrl, apiUrl, authClient } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import {
  changeFavorite,
  formatCount,
  recipeOptions,
  shareRecipe,
  sourceLabels,
} from '@/lib/recipes';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import guideBrow from '../../assets/plan-a/detail/guide-brow.svg';
import guideCheek from '../../assets/plan-a/detail/guide-cheek.svg';
import guideFace from '../../assets/plan-a/detail/guide-face.svg';
import guideShading from '../../assets/plan-a/detail/guide-shading.svg';

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
const UPLOAD = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/upload.xml'),
});

// Hero layout from Plan A ⑤ (390×540 frame). The guides and pins were drawn on its top 480pt.
const heroCrop: PhotoCrop = {
  width: '120.64%',
  height: '154.82%',
  left: '-12.18%',
  top: '-13.89%',
};
// Where Plan A puts each part's pin and label on its annotated photo (390×540 frame).
const planAPins: Partial<Record<PartId, { pin: FramePoint; label: FramePoint }>> = {
  brow: { pin: { x: 251, y: 177 }, label: { x: 272, y: 160 } },
  eye: { pin: { x: 101, y: 211 }, label: { x: 14, y: 186 } },
  lash: { pin: { x: 281, y: 227 }, label: { x: 302, y: 228 } },
  shading: { pin: { x: 75, y: 341 }, label: { x: 10, y: 370 } },
  cheek: { pin: { x: 271, y: 281 }, label: { x: 290, y: 306 } },
  lip: { pin: { x: 203, y: 381 }, label: { x: 236, y: 404 } },
};
// Plan A's annotated photo shows the fox recipe; other recipes show their own photo.
const planARecipe = 'fox';
type FramePoint = { x: number; y: number };
const atFrame = (x: number, y: number) =>
  ({ left: `${(x / 390) * 100}%`, top: `${(y / 540) * 100}%` }) as const;
// Plan A colors the tags in this order.
const tagBackgrounds = ['bg-base-peach', 'bg-base-lilac', 'bg-base-mint'];

/** What ⑤ shows of each step: its part icon and short name. */
type StepSummary = Pick<RecipeStep, 'part' | 'label'>;

// Plan A ⑤ レシピ詳細.
// ⑫-8 投稿のプレビュー shows the same screen with a プレビュー label on top, a single 投稿
// action, and the draft's cosmetics (null when the post does not publish them).
export function RecipeDetail({ id, onPost }: { id: string; onPost?: () => void }) {
  const query = useQuery({ ...recipeOptions(id), enabled: Boolean(apiUrl) });
  if (query.data) {
    return <RecipeContent recipe={query.data} steps={query.data.steps} onPost={onPost} />;
  }
  return (
    <RecipeStatus
      loading={query.isPending && Boolean(apiUrl)}
      message={
        !apiUrl
          ? '接続先が未設定です。セットアップ後にレシピを表示できます。'
          : query.data === null
            ? 'レシピが見つかりません'
            : query.isError
              ? 'レシピを読み込めませんでした。通信状況を確認してお試しください。'
              : 'レシピを読み込んでいます'
      }
      onRetry={
        query.isError
          ? () => {
              void query.refetch();
            }
          : undefined
      }
    />
  );
}

/** A full-screen loading, error or not-found state with a way back. */
export function RecipeStatus({
  message,
  loading,
  onRetry,
}: {
  message: string;
  loading: boolean;
  onRetry: (() => void) | undefined;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 6 }}>
      <StatusBar style="dark" />
      <View className="flex-row px-4">
        <GlassIconButton
          icon={BACK}
          label="戻る"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
      <View className="flex-1 justify-center px-6">
        <Feedback message={message} loading={loading} {...(onRetry ? { onRetry } : {})} />
      </View>
    </View>
  );
}

/** ⑤ for recipe data already in hand, e.g. ⑫-8's sample of the post being made. */
export function RecipeContent({
  recipe,
  steps,
  onPost,
  posting = false,
}: {
  recipe: RecipeData;
  /** Empty for a recipe without steps yet; it cannot start ⑦. */
  steps: StepSummary[];
  onPost: (() => void) | undefined;
  /** ⑫-8 is sending the post; 投稿 waits until it finishes. */
  posting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const likes = formatCount(recipe.likeCount);
  const tags = [
    ...recipe.tags.map((tag) => `＃${tag}`),
    `＃${recipe.durationMinutes}分`,
    ...(steps.length > 0 ? [`${steps.length}ステップ`] : []),
  ];
  // Plan A keeps the face and the sheet in place; only the sheet's content scrolls.
  const heroHeight = (window.width * 540) / 390;
  // Wide or short windows (iPad, landscape) keep Plan A's share of the screen for the sheet.
  const sheetTop = Math.min(heroHeight - 50, window.height * (490 / 844));
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <View className="absolute inset-x-0 top-0">
        <Hero recipe={recipe} steps={steps} />
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
              {tags.map((tag, index) => (
                <View
                  // Tags may repeat, e.g. a 15分 tag on a 15-minute recipe.
                  key={`${index}-${tag}`}
                  className={cn(
                    'min-h-6 justify-center rounded-xl px-2.5',
                    tagBackgrounds[index % tagBackgrounds.length],
                  )}
                >
                  <Text className="font-maru-bold text-micro text-ink-primary">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Pressable
              // ⑫-8 previews the user's own draft; leaving for a profile would drop the post.
              disabled={Boolean(onPost)}
              accessibilityRole={onPost ? undefined : 'button'}
              accessibilityHint={onPost ? undefined : 'プロフィールと投稿したレシピを開きます'}
              // The 36pt row keeps Plan A's look; hitSlop extends the target to 48pt.
              hitSlop={6}
              onPress={() => {
                router.push({ pathname: '/users/[id]', params: { id: recipe.author.id } });
              }}
              className="flex-1 flex-row items-center gap-2.5 active:opacity-70"
            >
              <ProfilePhoto size={36} image={recipe.author.image} />
              <View className="flex-1">
                <Text className="font-maru-bold text-label text-ink-primary">
                  {recipe.author.name}
                </Text>
                <Text className="font-maru text-meta text-ink-secondary">
                  {recipe.source ? `${sourceLabels[recipe.source]}から取り込み・` : ''}保存 {likes}
                </Text>
              </View>
            </Pressable>
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
          {steps.length > 0 ? (
            <>
              <Text
                accessibilityRole="header"
                className="font-maru-bold text-heading text-ink-primary"
              >
                手順
              </Text>
              {/* Plan A spreads a few steps over the row; a long posted recipe wraps instead. */}
              <View
                className={cn('flex-row', steps.length > 6 ? 'flex-wrap gap-3' : 'justify-between')}
              >
                {steps.map((step, index) => {
                  const part = parts[step.part];
                  return (
                    // A recipe may work on the same part twice, so the position is the key.
                    <View key={index} className="items-center gap-1">
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
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
          {recipe.products.length > 0 ? (
            <>
              <View className="flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  className="font-maru-bold text-heading text-ink-primary"
                >
                  使うメイク品
                </Text>
                <Text className="font-maru text-meta text-ink-secondary">
                  {recipe.products.length}点
                </Text>
              </View>
              {recipe.products.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </>
          ) : null}
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
        {onPost ? (
          <>
            <View className="flex-1 items-center">
              <View className="min-h-9 justify-center rounded-full border border-black bg-white px-[22px]">
                <Text className="font-maru-bold text-label text-ink-primary">プレビュー</Text>
              </View>
            </View>
            <View className="w-10" />
          </>
        ) : (
          <>
            <View className="flex-1" />
            <GlassIconButton
              icon={SHARE}
              label="共有"
              onPress={() => {
                shareRecipe(recipe, '見つけました');
              }}
            />
            <GlassIconButton icon={BOOKMARK} label="保存（準備中）" />
          </>
        )}
      </View>
      {onPost ? (
        <PostBar onPost={onPost} posting={posting} bottom={insets.bottom} />
      ) : (
        <RecipeStartBar recipe={recipe} canStart={steps.length > 0} bottom={insets.bottom} />
      )}
    </View>
  );
}

function Hero({ recipe, steps }: { recipe: RecipeData; steps: StepSummary[] }) {
  // Plan A's guides and pins are drawn on its own photo of the fox recipe.
  if (recipe.id !== planARecipe) {
    return (
      <View className="aspect-[390/540] w-full overflow-hidden bg-neutral-soft">
        <Image
          accessible={false}
          source={{ uri: apiAssetUrl(recipe.image) }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }
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
      {steps.map((step, index) => {
        const place = planAPins[step.part];
        if (!place) {
          return null;
        }
        return (
          // Steps are identified by their position; a part may appear twice.
          <Fragment key={index}>
            <View
              className="absolute size-[22px] items-center justify-center rounded-full bg-white/95"
              style={{
                ...atFrame(place.pin.x, place.pin.y),
                boxShadow: '0px 2px 6px rgba(196, 61, 112, 0.25)',
              }}
            >
              <View className="size-2.5 rounded-full bg-accent-rose" />
            </View>
            <View
              className="absolute flex-row items-center gap-[5px] rounded-[14px] border border-white bg-white/80 py-[3px] pl-[3px] pr-2.5"
              style={{
                ...atFrame(place.label.x, place.label.y),
                boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)',
              }}
            >
              <View className="size-5 items-center justify-center rounded-full bg-accent-rose">
                <Text className="font-maru-bold text-micro text-white">{index + 1}</Text>
              </View>
              <Text className="font-maru-bold text-micro text-ink-primary">{step.label}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

function ProductRow({ product }: { product: RecipeData['products'][number] }) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  // Only an https shop opens, whatever the API returns.
  const purchaseUrl = purchaseUrlSchema.safeParse(product.purchaseUrl).data;
  // The shop opens in the in-app browser (Safari View Controller or Custom Tabs).
  const openShop = purchaseUrl
    ? () => {
        void openBrowserAsync(purchaseUrl).catch(() => {
          Alert.alert('購入先を開けませんでした');
        });
      }
    : undefined;
  const content = (
    <>
      <View className="size-[52px] overflow-hidden rounded-[14px] bg-neutral-soft">
        {product.image ? (
          <Image
            accessible={false}
            source={{ uri: apiAssetUrl(product.image) }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{product.name}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{product.usage}</Text>
      </View>
      {openShop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="購入先を見る"
          // The 24pt chip keeps Plan A's look; hitSlop extends the target to 48pt.
          hitSlop={12}
          onPress={openShop}
          className="min-h-6 flex-row items-center gap-1 rounded-xl bg-base-peach px-2.5 active:opacity-70"
        >
          <SocialIcon name={CART} size={12} color={ink} />
          <Text className="font-maru-bold text-micro text-ink-primary">買う</Text>
        </Pressable>
      ) : null}
      <SocialIcon name={NEXT} size={18} color={secondary} />
    </>
  );
  const className =
    'flex-row items-center gap-3 rounded-[18px] border border-line-soft bg-bg-surface p-2.5';
  // VoiceOver reads the row as one element, so 買う is also offered as an action on the row.
  const purchase = openShop
    ? {
        accessibilityActions: [{ name: 'purchase', label: '購入先を見る' }],
        onAccessibilityAction: (event: AccessibilityActionEvent) => {
          if (event.nativeEvent.actionName === 'purchase') {
            openShop();
          }
        },
      }
    : {};
  // Only products with Plan A detail data open ⑥ until product details come from the API.
  if (!findProduct(product.id)) {
    // The row itself does nothing yet; with a shop, 買う stays its own button for screen readers.
    if (openShop) {
      return <View className={className}>{content}</View>;
    }
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${product.name}、${product.usage}（準備中）`}
        accessibilityState={{ disabled: true }}
        className={className}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}、${product.usage}`}
      className={cn(className, 'active:opacity-80')}
      onPress={() => {
        router.push(`/products/${product.id}`);
      }}
      {...purchase}
    >
      {content}
    </Pressable>
  );
}

function PostBar({
  onPost,
  posting,
  bottom,
}: {
  onPost: () => void;
  posting: boolean;
  bottom: number;
}) {
  const white = useTokenColor('--color-bg-surface');
  return (
    <View
      className="absolute inset-x-0 bottom-0 bg-[rgba(242,242,242,0.85)] px-4 pt-3"
      style={{ paddingBottom: Math.max(bottom, 12) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={posting ? '投稿しています' : '投稿'}
        accessibilityState={{ disabled: posting, busy: posting }}
        disabled={posting}
        onPress={onPost}
        className={cn(
          'min-h-[52px] flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-5 active:opacity-80',
          posting && 'opacity-60',
        )}
        style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
      >
        {posting ? (
          <ActivityIndicator color={white} />
        ) : (
          <SocialIcon name={UPLOAD} size={20} color={white} />
        )}
        <Text className="font-maru-bold text-action text-white">
          {posting ? '投稿しています' : '投稿'}
        </Text>
      </Pressable>
    </View>
  );
}

function RecipeStartBar({
  recipe,
  canStart,
  bottom,
}: {
  recipe: RecipeData;
  canStart: boolean;
  bottom: number;
}) {
  const favorite = useFavorite(recipe);
  return (
    <StartBar
      bottom={bottom}
      favorite={favorite}
      onStart={
        canStart
          ? () => {
              router.push(`/recipes/${recipe.id}/steps`);
            }
          : undefined
      }
    />
  );
}

/**
 * ⑤'s favorite button. Guests are sent to ⑱ first (#42). The change shows at once and is rolled
 * back if the server rejects it; only this recipe's cache entry changes.
 */
function useFavorite(recipe: RecipeData) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const key = recipeOptions(recipe.id).queryKey;
  const toggle = useMutation({
    mutationFn: (favorited: boolean) => changeFavorite(recipe.id, favorited),
    onMutate: async (favorited) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData(key);
      client.setQueryData(key, (current) =>
        current ? { ...current, favorited: !favorited } : current,
      );
      return { previous };
    },
    onError: (error, _favorited, context) => {
      client.setQueryData(key, context?.previous);
      Alert.alert('お気に入りを変更できませんでした', error.message);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['recipes', 'favorites'] });
    },
  });
  return {
    favorited: recipe.favorited,
    onPress: () => {
      if (!session) {
        router.push('/account');
        return;
      }
      if (!toggle.isPending) {
        toggle.mutate(recipe.favorited);
      }
    },
  };
}
