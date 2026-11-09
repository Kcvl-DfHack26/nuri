import type { InfiniteData } from '@tanstack/react-query';

import { Icon } from '@expo/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RecipePage, RecipeSummary } from '@/lib/recipes';
import type { UserProfile } from '@/lib/social';

import { Avatar } from '@/components/avatar';
import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { PrimaryButton } from '@/components/post-chrome';
import { RecipeCardMetadata } from '@/components/recipe-card';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiAssetUrl, apiUrl, authClient } from '@/lib/api';
import { faceTypes } from '@/lib/face-diagnosis';
import { favoriteListOptions, formatCount, recipeListOptions } from '@/lib/recipes';
import { myProfileOptions, userOptions } from '@/lib/social';
import { useTokenColor } from '@/theme/tokens';

const SETTINGS = Icon.select({
  ios: 'gearshape.fill',
  android: import('@expo/material-symbols/settings.xml'),
});
const PERSON = Icon.select({
  ios: 'person.fill',
  android: import('@expo/material-symbols/person.xml'),
});

// Plan A ⑰ マイページ. The name and photo come from the session; the follow and like counts, the
// recipes the user posted and kept as favorites come from the API.
export function MyPage() {
  const insets = useSafeAreaInsets();
  // The tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  // Only its owner reads the face type (#194), so it comes from the own profile, not ⑰'s counts.
  const { data: own } = useQuery({
    ...myProfileOptions(user?.id),
    enabled: Boolean(user && apiUrl),
  });
  const posted = useInfiniteQuery({
    ...recipeListOptions(user ? { author: user.id } : {}),
    enabled: Boolean(user),
  });
  const favorites = useInfiniteQuery({
    ...favoriteListOptions(user?.id ?? ''),
    enabled: Boolean(user),
  });
  const profile = useQuery({ ...userOptions(user?.id ?? ''), enabled: Boolean(user) });
  // iOS insets the tab's first ScrollView for the status bar and tab bar; Android adds both here.
  const scrollTop = Platform.OS === 'ios' ? 0 : insets.top;
  const scrollBottom = Platform.OS === 'ios' ? 0 : insets.bottom;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4"
        contentContainerStyle={{ paddingTop: scrollTop + 8, paddingBottom: scrollBottom + 28 }}
      >
        <View className="flex-row items-center gap-3.5">
          <View className="size-16 items-center justify-center overflow-hidden rounded-full border-3 border-accent-pink">
            <ProfilePhoto size={58} image={user?.image} />
          </View>
          <View className="flex-1 gap-0.5">
            {isPending ? (
              <ActivityIndicator accessibilityLabel="読み込み中" />
            ) : (
              <>
                <Text
                  accessibilityRole="header"
                  className="font-maru-bold text-headline text-ink-primary"
                >
                  {user ? user.name : 'ゲスト'}
                </Text>
                {user ? (
                  own?.faceType ? (
                    <Text className="font-maru text-meta text-ink-secondary">
                      {faceTypes[own.faceType].label}
                    </Text>
                  ) : null
                ) : (
                  <Text className="font-maru text-meta text-ink-secondary">
                    ログインするとプロフィールを表示します
                  </Text>
                )}
              </>
            )}
          </View>
          <GlassIconButton
            icon={SETTINGS}
            label="プロフィール設定"
            className="border-black/8 bg-white"
            onPress={() => {
              router.push('/profile-settings');
            }}
          />
        </View>
        {user ? (
          <>
            {profile.isError ? (
              <Feedback
                message="フォロワーなどの数を読み込めませんでした。"
                onRetry={() => {
                  void profile.refetch();
                }}
              />
            ) : (
              <ProfileCounts profile={profile.data} />
            )}
            <RecipeSection
              title="投稿"
              empty="まだ投稿したレシピはありません"
              failure="投稿を読み込めませんでした。通信状況を確認してお試しください。"
              query={posted}
            />
            <RecipeSection
              title="お気に入り"
              empty="お気に入りのレシピはまだありません"
              failure="お気に入りを読み込めませんでした。通信状況を確認してお試しください。"
              query={favorites}
            />
          </>
        ) : isPending ? null : (
          <View className="mt-5">
            <PrimaryButton
              label="ログイン"
              onPress={() => {
                router.push('/account');
              }}
            />
          </View>
        )}
      </ScrollView>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insets.top + 14,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,0) 100%)',
        }}
      />
    </View>
  );
}

/** The session's photo, or a centered person symbol when there is none (also for guests). */
export function ProfilePhoto({ size, image }: { size: number; image?: string | null | undefined }) {
  const secondary = useTokenColor('--color-ink-secondary');
  if (image) {
    return <Avatar size={size} image={image} />;
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-neutral-soft"
      style={{ width: size, height: size }}
    >
      <SocialIcon name={PERSON} size={Math.round(size * 0.5)} color={secondary} />
    </View>
  );
}

/**
 * Plan A's フォロワー・フォロー中・いいね under the name (⑰ and other profiles). いいね is how often
 * the user's recipes were favorited. Dashes stand in until the profile loads.
 */
export function ProfileCounts({
  profile,
}: {
  profile: Pick<UserProfile, 'followerCount' | 'followingCount' | 'likeCount'> | undefined;
}) {
  const counts = [
    { label: 'フォロワー', value: profile?.followerCount },
    { label: 'フォロー中', value: profile?.followingCount },
    { label: 'いいね', value: profile?.likeCount },
  ];
  return (
    <View className="mt-4 flex-row gap-2.5">
      {counts.map(({ label, value }) => {
        const shown = value === undefined ? '—' : formatCount(value);
        return (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label} ${shown}`}
            className="flex-1 items-center gap-0.5 rounded-card bg-bg-base px-2 py-3"
          >
            <Text className="font-maru-bold text-headline text-ink-primary">{shown}</Text>
            <Text className="font-maru text-meta text-ink-secondary">{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

type RecipePages = InfiniteData<RecipePage, unknown>;

/** A titled two-column grid of recipes with its loading, error, empty and more states. */
export function RecipeSection({
  title,
  empty,
  failure,
  query,
}: {
  title: string;
  empty: string;
  failure: string;
  query: {
    data: RecipePages | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
  };
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const rows = Array.from({ length: Math.ceil(items.length / 2) }, (_, row) =>
    items.slice(row * 2, row * 2 + 2),
  );
  return (
    <>
      <Text
        accessibilityRole="header"
        className="mt-3 px-1 pt-0.5 font-maru-bold text-heading text-ink-primary"
      >
        {title}
      </Text>
      {query.isPending ? (
        <Feedback loading message="読み込んでいます" />
      ) : query.isError ? (
        <Feedback
          message={failure}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <Feedback message={empty} />
      ) : (
        <View className="mt-1.5 gap-3">
          {rows.map((row) => (
            <View key={row[0]?.id} className="flex-row gap-3">
              {row.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
          {query.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              disabled={query.isFetchingNextPage}
              onPress={() => {
                void query.fetchNextPage();
              }}
              className="min-h-12 items-center justify-center rounded-full border border-line-soft active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-ink-primary">
                {query.isFetchingNextPage ? '読み込み中…' : 'もっと見る'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const likes = formatCount(recipe.likeCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}、${recipe.author.name}、お気に入り${likes}`}
      className="flex-1 gap-1.25 active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      <View className="aspect-173/230 w-full overflow-hidden rounded-card bg-neutral-soft">
        <Image
          accessible={false}
          source={{ uri: apiAssetUrl(recipe.image) }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      <RecipeCardMetadata recipe={recipe} likes={likes} />
    </Pressable>
  );
}
