import { Button as NativeButton } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Feed } from '@/components/feed';
import { Feedback } from '@/components/feedback';
import { NativeHost } from '@/components/native-host';
import { Text } from '@/components/ui/text';
import { api, apiUrl, authClient } from '@/lib/api';
import { colors } from '@/theme/colors';
import { avatarSize } from '@/theme/metrics';

// Another user's profile opened from a post. Your own profile is the マイ tab (⑰).
export function Profile({ id }: { id: string }) {
  const { data: session } = authClient.useSession();
  const profile = useQuery({
    queryKey: ['user', id],
    enabled: Boolean(apiUrl),
    queryFn: async () => {
      const response = await api.api.users[':id'].$get({ param: { id } });
      if (response.status !== 200) {
        throw new Error('プロフィールを読み込めませんでした。');
      }
      return await response.json();
    },
  });
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
  const person = profile.data.user;
  return (
    <Feed
      authorId={person.id}
      header={
        <View style={{ paddingTop: 20, backgroundColor: colors.background }}>
          <View
            style={{
              marginHorizontal: 20,
              padding: 24,
              borderRadius: 20,
              backgroundColor: colors.card,
              gap: 16,
              alignItems: 'center',
            }}
          >
            <Avatar size={avatarSize * 2} image={person.image} />
            <Text variant="h3" className="text-center font-bold">
              {person.name}
            </Text>
            {person.handle ? <Text className="text-muted-foreground">@{person.handle}</Text> : null}
            {person.bio ? <Text className="text-center">{person.bio}</Text> : null}
            {session?.user.id === person.id ? (
              <NativeHost matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
                <NativeButton
                  label="プロフィールを編集"
                  variant="outlined"
                  onPress={() => {
                    router.push('/profile-settings');
                  }}
                />
              </NativeHost>
            ) : null}
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 }}>
            <Text accessibilityRole="header" className="font-semibold text-muted-foreground">
              投稿
            </Text>
          </View>
        </View>
      }
    />
  );
}
