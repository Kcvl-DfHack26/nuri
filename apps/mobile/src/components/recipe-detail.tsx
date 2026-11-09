import type { ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

import { Icon } from '@expo/ui';
import { purchaseUrlSchema } from '@starter/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { openBrowserAsync } from 'expo-web-browser';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RecipeDetail as RecipeData, RecipeStep } from '@/lib/recipes';

import { Feedback } from '@/components/feedback';
import { FollowButton } from '@/components/follow-button';
import { GlassIconButton } from '@/components/glass-icon-button';
import { ProfilePhoto } from '@/components/my-page';
import { OpenNativeAppLink } from '@/components/open-native-app-link';
import { findProduct, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { StartBar } from '@/components/start-bar';
import { Text } from '@/components/ui/text';
import { useFavorite } from '@/components/use-favorite';
import { apiAssetUrl, apiUrl } from '@/lib/api';
import { hasRoomForSidePanel, useLayoutSize } from '@/lib/layout';
import { backOrHome } from '@/lib/navigation';
import { formatCount, recipeOptions, shareRecipe } from '@/lib/recipes';
import { userOptions } from '@/lib/social';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/ios_share.xml'),
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
    return (
      <RecipeContent
        recipe={query.data}
        steps={query.data.steps}
        onPost={onPost}
        appLink={onPost ? null : <OpenNativeAppLink recipeId={query.data.id} />}
      />
    );
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
  appLink,
  areas,
}: {
  recipe: RecipeData;
  /** Empty for a recipe without steps yet; it cannot start ⑦. */
  steps: StepSummary[];
  onPost: (() => void) | undefined;
  /** ⑫-8 is sending the post; 投稿 waits until it finishes. */
  posting?: boolean;
  appLink?: ReactNode;
  /** ⑫-8's picture of every step's area on a sample face (#202). */
  areas?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width, height, onLayout } = useLayoutSize();
  const wide = hasRoomForSidePanel(width, height);
  const headerWidth = wide ? '48%' : '100%';
  const tags = [
    ...recipe.tags.map((tag) => `＃${tag}`),
    `＃${recipe.durationMinutes}分`,
    ...(steps.length > 0 ? [`${steps.length}ステップ`] : []),
  ];
  // Plan A keeps the face and the sheet in place; only the sheet's content scrolls.
  const heroWidth = height > 0 ? Math.min(width, height * 0.8) : undefined;
  const sheetTop =
    heroWidth === undefined
      ? ('58%' as const)
      : Math.min((heroWidth * 540) / 390 - 50, height * (490 / 844));
  return (
    <View className="flex-1 bg-white" onLayout={onLayout}>
      <StatusBar style="dark" />
      <View
        className={cn(
          'absolute top-0 items-center overflow-hidden bg-bg-surface',
          wide ? 'inset-y-0 left-0' : 'inset-x-0',
        )}
        style={wide ? { width: '48%' } : undefined}
      >
        <View className="w-full" style={{ maxWidth: heroWidth }}>
          <Hero recipe={recipe} />
        </View>
      </View>
      <View
        className={cn(
          'absolute bottom-0 bg-white',
          wide ? 'inset-y-0 right-0' : 'inset-x-0 rounded-t-sheet',
        )}
        style={{
          top: wide ? 0 : sheetTop,
          width: wide ? '52%' : undefined,
          boxShadow: '0px -6px 24px rgba(196, 61, 112, 0.1)',
        }}
      >
        <ScrollView
          className="rounded-t-sheet"
          contentInsetAdjustmentBehavior="never"
          contentContainerClassName="gap-3 px-5"
          contentContainerStyle={{
            paddingTop: wide ? insets.top + 20 : 20,
            paddingRight: wide ? insets.right + 20 : 20,
            paddingBottom: insets.bottom + 96,
          }}
        >
          <View className="gap-2">
            <Text
              accessibilityRole="header"
              className="font-maru-bold text-headline text-ink-primary"
            >
              {recipe.title}
            </Text>
            {appLink}
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
          <AuthorRow
            author={recipe.author}
            likeCount={recipe.likeCount}
            preview={Boolean(onPost)}
          />
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
                          'size-11.5 items-center justify-center rounded-full',
                          part.iconBackground,
                        )}
                      >
                        <Image
                          accessible={false}
                          source={part.icon}
                          style={{ width: 22, height: 22 }}
                        />
                        <View className="absolute -top-0.5 left-7.5 size-4.5 items-center justify-center rounded-full border-fine border-white bg-accent-rose">
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
          {areas}
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
        {onPost ? (
          <PostBar onPost={onPost} posting={posting} bottom={insets.bottom} />
        ) : (
          <RecipeStartBar recipe={recipe} canStart={steps.length > 0} bottom={insets.bottom} />
        )}
      </View>
      <View
        pointerEvents="none"
        className="absolute left-0 top-0 h-27.5"
        style={{
          width: headerWidth,
          backgroundImage:
            'linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0))',
        }}
      />
      <View
        className="absolute left-0 flex-row items-center gap-2"
        style={{
          width: headerWidth,
          top: insets.top + 6,
          paddingLeft: insets.left + 16,
          paddingRight: (wide ? 0 : insets.right) + 16,
        }}
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
              <View className="min-h-9 justify-center rounded-full border border-black bg-white px-5.5">
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
          </>
        )}
      </View>
    </View>
  );
}

// ⑤'s photo is the recipe's own picture, like its card in ① (#193).
function Hero({ recipe }: { recipe: RecipeData }) {
  return (
    <View className="aspect-390/540 w-full overflow-hidden bg-neutral-soft">
      <Image
        accessible={false}
        source={{ uri: apiAssetUrl(recipe.image) }}
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

function ProductRow({ product }: { product: RecipeData['products'][number] }) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  // Only products with Plan A detail data open ⑥ until product details come from the API.
  const hasDetails = findProduct(product.id) !== undefined;
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
      <View className="size-13 overflow-hidden rounded-thumbnail bg-neutral-soft">
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
          <SocialIcon name={CART} webGlyph="↗" size={12} color={ink} />
          <Text className="font-maru-bold text-micro text-ink-primary">買う</Text>
        </Pressable>
      ) : null}
      {/* Only rows that open ⑥ show the chevron. */}
      {hasDetails ? <SocialIcon name={NEXT} webGlyph="›" size={18} color={secondary} /> : null}
    </>
  );
  const className =
    'flex-row items-center gap-3 rounded-card border border-line-soft bg-bg-surface p-2.5';
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
  if (!hasDetails) {
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
      className="absolute inset-x-0 bottom-0 bg-tab-glass px-4 pt-3"
      style={{ paddingBottom: Math.max(bottom, 12) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={posting ? '投稿しています' : '投稿'}
        accessibilityState={{ disabled: posting, busy: posting }}
        disabled={posting}
        onPress={onPost}
        className={cn(
          'min-h-13 flex-row items-center justify-center gap-1.5 rounded-full bg-accent-rose px-5 active:opacity-80',
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

// ⑤'s author with their follower count and likes, and the follow button. The author's profile
// gives the count and whether the viewer follows them. A private author has none to read, and ⑫-8
// previews the user's own draft, so both show likes only.
function AuthorRow({
  author,
  likeCount,
  preview,
}: {
  author: RecipeData['author'];
  likeCount: number;
  preview: boolean;
}) {
  const profile = useQuery({ ...userOptions(author.id), enabled: Boolean(apiUrl) && !preview });
  // A cached profile (e.g. the user's own from ⑰) still shows in ⑫-8's preview, so check it too.
  const followers =
    !preview && profile.data ? `フォロワー ${formatCount(profile.data.followerCount)}・` : '';
  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        // ⑫-8 previews the user's own draft; leaving for a profile would drop the post.
        disabled={preview}
        accessibilityRole={preview ? undefined : 'button'}
        accessibilityHint={preview ? undefined : 'プロフィールと投稿したレシピを開きます'}
        // The 36pt row keeps Plan A's look; hitSlop extends the target to 48pt.
        hitSlop={6}
        onPress={() => {
          router.push({ pathname: '/users/[id]', params: { id: author.id } });
        }}
        className="flex-1 flex-row items-center gap-2.5 active:opacity-70"
      >
        <ProfilePhoto size={36} image={author.image} />
        <View className="flex-1">
          <Text className="font-maru-bold text-label text-ink-primary">{author.name}</Text>
          <Text className="font-maru text-meta text-ink-secondary">
            {followers}お気に入り {formatCount(likeCount)}
          </Text>
        </View>
      </Pressable>
      {preview ? null : <FollowButton user={profile.data} />}
    </View>
  );
}
