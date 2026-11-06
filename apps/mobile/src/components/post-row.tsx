import { Icon } from '@expo/ui';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import type { Post, FeedData } from '@/lib/social';

import { Avatar } from '@/components/avatar';
import { Feedback } from '@/components/feedback';
import { SocialIcon } from '@/components/social-icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatPostDate } from '@/lib/date';
import { usePreferences } from '@/lib/preferences';
import { changeLike, deletePost, updateFeedPost } from '@/lib/social';
import { colors } from '@/theme/colors';
import { avatarSize } from '@/theme/metrics';

export const PostRow = memo(function PostRow({
  item,
  viewerId,
  now,
}: {
  item: Post;
  viewerId: string | undefined;
  now: number;
}) {
  const date = formatPostDate(item.createdAt, now);
  const client = useQueryClient();
  const { preferences } = usePreferences();
  const mutationKey = ['like', viewerId, item.id];
  const pending = useIsMutating({ mutationKey }) > 0;
  const like = useMutation({
    mutationKey,
    mutationFn: (liked: boolean) => changeLike(item.id, liked),
    onMutate: async (liked) => {
      const filter = { queryKey: ['posts', viewerId] };
      await client.cancelQueries(filter);
      const previous = client.getQueriesData<FeedData>(filter).map(([key, data]) => ({
        key,
        post: data?.pages.flatMap((page) => page.items).find((post) => post.id === item.id),
      }));
      client.setQueriesData<FeedData>(filter, (data) =>
        updateFeedPost(data, item.id, (post) => ({
          ...post,
          liked: !liked,
          likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)),
        })),
      );
      return previous;
    },
    onError: (_error, _variables, previous) => {
      // Roll back only this post: a concurrent like on another row must survive.
      for (const snapshot of previous ?? []) {
        const saved = snapshot.post;
        if (saved) {
          client.setQueryData<FeedData>(snapshot.key, (data) =>
            updateFeedPost(data, item.id, (post) => ({
              ...post,
              liked: saved.liked,
              likeCount: saved.likeCount,
            })),
          );
        }
      }
    },
    onSuccess: () => {
      if (preferences.haptics) {
        void Haptics.selectionAsync().catch(() => {});
      }
    },
  });
  const remove = useMutation({
    mutationFn: deletePost,
    onSuccess: () => client.invalidateQueries({ queryKey: ['posts'] }),
  });
  return (
    <View
      className="mx-3 mb-2 flex-row gap-2 rounded-2xl px-3 pt-3"
      style={{ backgroundColor: colors.card }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.author.name}のプロフィール`}
        style={{ width: avatarSize, minHeight: 48 }}
        hitSlop={4}
        onPress={() => {
          router.push({ pathname: '/users/[id]', params: { id: item.author.id } });
        }}
      >
        <Avatar image={item.author.image} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="font-semibold">{item.author.name}</Text>
          <Text className="text-caption text-muted-foreground" accessibilityLabel={date.full}>
            {date.short}
          </Text>
        </View>
        <Text selectable className="text-body">
          {item.body}
        </Text>
        <View className="flex-row items-center justify-end gap-1">
          <Button
            variant="ghost"
            className="rounded-full px-2"
            accessibilityLabel={`${item.liked ? 'いいね済み' : 'いいね'} ${item.likeCount}`}
            accessibilityState={{ selected: item.liked, disabled: pending }}
            disabled={pending}
            onPress={() => {
              if (!viewerId) {
                router.push('/account');
                return;
              }
              like.mutate(item.liked);
            }}
          >
            <SocialIcon
              name={
                item.liked
                  ? Icon.select({
                      ios: 'heart.fill',
                      android: import('@expo/material-symbols/favorite.xml'),
                    })
                  : Icon.select({
                      ios: 'heart',
                      android: import('@expo/material-symbols/favorite.xml'),
                    })
              }
              color={item.liked ? colors.destructive : colors.secondary}
            />
            <Text
              className="text-caption tabular-nums"
              style={{ color: item.liked ? colors.destructive : colors.secondary }}
            >
              {item.likeCount}
            </Text>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            accessibilityLabel="投稿を共有"
            onPress={() => {
              void Share.share({ message: `${item.author.name}\n${item.body}` }).catch(() => {
                Alert.alert('共有できませんでした', 'もう一度お試しください。');
              });
            }}
          >
            <SocialIcon
              name={Icon.select({
                ios: 'square.and.arrow.up',
                android: import('@expo/material-symbols/share.xml'),
              })}
              color={colors.secondary}
            />
          </Button>
          {item.author.id === viewerId ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              accessibilityLabel="投稿を削除"
              disabled={remove.isPending}
              onPress={() => {
                Alert.alert('投稿を削除', 'この操作は取り消せません。', [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: '削除',
                    style: 'destructive',
                    onPress: () => {
                      remove.mutate(item.id);
                    },
                  },
                ]);
              }}
            >
              <SocialIcon
                name={Icon.select({
                  ios: 'trash',
                  android: import('@expo/material-symbols/delete.xml'),
                })}
                color={colors.secondary}
              />
            </Button>
          ) : null}
        </View>
        {like.error || remove.error ? (
          <Feedback
            message={like.error?.message ?? remove.error?.message ?? ''}
            onRetry={() => {
              if (like.error) {
                like.mutate(item.liked);
              } else {
                remove.mutate(item.id);
              }
            }}
          />
        ) : null}
      </View>
    </View>
  );
});
