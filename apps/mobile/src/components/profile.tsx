import { Icon } from '@expo/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feedback } from '@/components/feedback';
import { FollowButton } from '@/components/follow-button';
import { GlassIconButton } from '@/components/glass-icon-button';
import { ProfileCounts, ProfilePhoto, RecipeSection } from '@/components/my-page';
import { Text } from '@/components/ui/text';
import { apiUrl, authClient } from '@/lib/api';
import { recipeListOptions } from '@/lib/recipes';
import { userOptions } from '@/lib/social';

const SETTINGS = Icon.select({
  ios: 'gearshape.fill',
  android: import('@expo/material-symbols/settings.xml'),
});

// Another user's profile, opened from a recipe's author (⑤): the same look as ⑰ with a follow
// button, their counts and the recipes they posted (#195). Plan A has no design for it. Opened for
// yourself, it offers プロフィール設定 instead of following.
export function Profile({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const recipes = useInfiniteQuery({
    ...recipeListOptions({ author: id }),
    enabled: Boolean(apiUrl),
  });
  const profile = useQuery({ ...userOptions(id), enabled: Boolean(apiUrl) });
  if (!apiUrl) {
    return <Feedback fullScreen message="接続先が未設定です。" />;
  }
  if (profile.isPending) {
    return <Feedback fullScreen loading message="プロフィールを読み込んでいます" />;
  }
  if (profile.isError) {
    return (
      <Feedback
        fullScreen
        message={profile.error.message}
        onRetry={() => {
          void profile.refetch();
        }}
      />
    );
  }
  const person = profile.data;
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-4"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 28 }}
    >
      <View className="flex-row items-center gap-3.5">
        <View className="size-16 items-center justify-center overflow-hidden rounded-full border-3 border-accent-pink">
          <ProfilePhoto size={58} image={person.image} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            accessibilityRole="header"
            className="font-maru-bold text-headline text-ink-primary"
          >
            {person.name}
          </Text>
          {person.handle ? (
            <Text className="font-maru text-meta text-ink-secondary">@{person.handle}</Text>
          ) : null}
        </View>
        {session?.user.id === person.id ? (
          <GlassIconButton
            icon={SETTINGS}
            label="プロフィール設定"
            className="border-black/8 bg-white"
            onPress={() => {
              router.push('/profile-settings');
            }}
          />
        ) : (
          <FollowButton user={person} />
        )}
      </View>
      {person.bio ? (
        <Text className="mt-3 font-maru text-ui text-ink-primary">{person.bio}</Text>
      ) : null}
      <ProfileCounts profile={person} />
      <RecipeSection
        title="レシピ"
        empty="まだ投稿したレシピはありません"
        failure="レシピを読み込めませんでした。通信状況を確認してお試しください。"
        query={recipes}
      />
    </ScrollView>
  );
}
