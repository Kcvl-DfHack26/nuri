import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { GlassIconButton } from '@/components/glass-icon-button';
import { PrimaryButton } from '@/components/post-chrome';
import { findRecipe } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import sampleAvatar from '../../assets/plan-a/my/avatar.png';

const SETTINGS = Icon.select({
  ios: 'gearshape.fill',
  android: import('@expo/material-symbols/settings.xml'),
});
const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

// Plan A sample profile numbers and posts until profiles and posts come from the API.
const stats = [
  { label: 'フォロワー', value: '328', background: 'bg-base-lilac' },
  { label: 'フォロー中', value: '96', background: 'bg-base-mint' },
  { label: 'いいね', value: '2.4k', background: 'bg-base-peach' },
];
const posts = [
  { recipe: 'round', tag: '丸顔向け', author: 'nana', likes: '2.6k' },
  { recipe: 'office', tag: '時短', author: 'kana', likes: '1.8k' },
  { recipe: 'cat', tag: 'たれ目向け', author: 'saki', likes: '1.8k' },
  { recipe: 'long', tag: '面長向け', author: 'mio', likes: '2.6k' },
  { recipe: 'fox', tag: '切れ長向け', author: 'rina', likes: '1.8k' },
  { recipe: 'korean', tag: '透明感', author: 'yuna', likes: '2.6k' },
] as const;
type Post = (typeof posts)[number];

// Plan A ⑰ マイページ. The name and photo come from the session; the face type, numbers and
// posts are Plan A samples, which the screen says.
export function MyPage() {
  const insets = useSafeAreaInsets();
  // The tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  // iOS insets the tab's first ScrollView for the status bar and tab bar; Android tabs only
  // pad the tab bar, so the status bar is added here.
  const scrollTop = Platform.OS === 'ios' ? 0 : insets.top;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4"
        contentContainerStyle={{ paddingTop: scrollTop + 8, paddingBottom: 28 }}
      >
        <View className="flex-row items-center gap-3.5">
          <View className="size-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-accent-pink">
            {user?.image ? (
              <Avatar size={58} image={user.image} />
            ) : user ? (
              <Image accessible={false} source={sampleAvatar} style={{ width: 58, height: 58 }} />
            ) : (
              <Avatar size={58} />
            )}
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
                <Text className="font-maru text-meta text-ink-secondary">
                  {user ? '丸顔×イエベ・投稿 12' : 'ログインするとプロフィールを表示します'}
                </Text>
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
            <View className="mt-4 flex-row gap-2">
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  accessible
                  accessibilityLabel={`${stat.label} ${stat.value}`}
                  className={cn('flex-1 items-center rounded-[18px] px-2 py-2.5', stat.background)}
                >
                  <Text className="font-maru-bold text-heading text-ink-primary">{stat.value}</Text>
                  <Text className="font-maru-bold text-micro text-ink-secondary">{stat.label}</Text>
                </View>
              ))}
            </View>
            <Text className="mt-2 px-1 font-maru text-meta text-ink-secondary">
              顔タイプ・数字・投稿は見本です
            </Text>
            <Text
              accessibilityRole="header"
              className="mt-3 px-1 pt-0.5 font-maru-bold text-heading text-ink-primary"
            >
              投稿
            </Text>
            <View className="mt-1.5 gap-3">
              {[0, 2, 4].map((start) => (
                <View key={start} className="flex-row gap-3">
                  {posts.slice(start, start + 2).map((post) => (
                    <PostCard key={post.recipe} post={post} />
                  ))}
                </View>
              ))}
            </View>
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

function PostCard({ post }: { post: Post }) {
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const recipe = findRecipe(post.recipe);
  if (!recipe) {
    return null;
  }
  const label = `${recipe.title}、${post.author}`;
  const content = (
    <>
      <View className="aspect-[173/230] w-full overflow-hidden rounded-[18px]">
        <Image
          accessible={false}
          source={recipe.thumbnail}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        <View
          className="absolute left-2 top-2 rounded-2xl border border-white bg-white/78 px-3 py-1.5"
          style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
        >
          <Text className="font-maru-bold text-micro text-ink-primary">{post.tag}</Text>
        </View>
        <View className="absolute bottom-2 right-2 size-[30px] items-center justify-center rounded-full bg-white/85">
          <SocialIcon name={HEART} size={16} color={ink} />
        </View>
      </View>
      <View className="w-full gap-px px-1 pt-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        <View className="flex-row items-center gap-[3px]">
          <Text className="flex-1 font-maru text-meta text-ink-secondary">{post.author}</Text>
          <SocialIcon name={HEART} size={13} color={secondary} />
          <Text className="font-maru text-meta text-ink-secondary">{post.likes}</Text>
        </View>
      </View>
    </>
  );
  // Only recipes with Plan A detail screens open ⑤; the rest are catalog previews.
  if (!recipe.detail) {
    return (
      <View accessible accessibilityLabel={label} className="flex-1 gap-[5px]">
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 gap-[5px] active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      {content}
    </Pressable>
  );
}
