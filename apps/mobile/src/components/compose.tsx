import { Icon } from '@expo/ui';
import { postInputSchema } from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Feedback } from '@/components/feedback';
import { Screen } from '@/components/screen';
import { SocialIcon } from '@/components/social-icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api, authClient } from '@/lib/api';
import { colors } from '@/theme/colors';

export function Compose() {
  const { data: session } = authClient.useSession();
  const [body, setBody] = useState('');
  const client = useQueryClient();
  const post = useMutation({
    mutationFn: async () => {
      const response = await api.api.posts.$post({ json: postInputSchema.parse({ body }) });
      if (response.status !== 201) {
        throw new Error(
          '投稿できませんでした。通信状況とログイン状態を確認してください。本文は残っています。',
        );
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['posts'] });
      router.back();
    },
  });
  if (!session) {
    return <Feedback fullScreen message="投稿するにはログインしてください。" />;
  }
  return (
    <Screen>
      <View className="flex-row items-start gap-3">
        <Avatar image={session.user.image} />
        <View className="min-w-0 flex-1 gap-2">
          <Text className="font-bold">{session.user.name}</Text>
          <Text className="text-caption text-muted-foreground">全員に公開</Text>
          <TextInput
            accessibilityLabel="投稿の本文"
            placeholder="いまどうしてる？"
            placeholderTextColor={colors.secondary}
            className="text-body"
            multiline
            value={body}
            maxLength={500}
            style={{
              minHeight: 180,

              color: colors.text,
              paddingVertical: 12,
              textAlignVertical: 'top',
            }}
            onChangeText={setBody}
            editable={!post.isPending}
            testID="post-body"
          />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <Text className="text-caption text-muted-foreground">{body.length} / 500文字</Text>
        <Button
          className="rounded-full px-6"
          disabled={post.isPending || !postInputSchema.safeParse({ body }).success}
          onPress={() => {
            post.mutate();
          }}
          testID="submit-post"
        >
          <SocialIcon
            name={Icon.select({
              ios: 'arrow.up',
              android: import('@expo/material-symbols/arrow_upward.xml'),
            })}
            color={colors.background}
          />
          <Text>{post.isPending ? '投稿中' : '投稿する'}</Text>
        </Button>
      </View>
      {post.error ? (
        <Feedback
          message={post.error.message}
          onRetry={() => {
            post.mutate();
          }}
        />
      ) : null}
    </Screen>
  );
}
