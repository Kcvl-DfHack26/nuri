import type { ReactElement } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feedback } from '@/components/feedback';
import { PostRow } from '@/components/post-row';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { apiUrl, authClient } from '@/lib/api';
import { feedOptions } from '@/lib/social';
import { colors } from '@/theme/colors';

export function Feed({ authorId, header }: { authorId?: string; header?: ReactElement }) {
  const insets = useSafeAreaInsets();
  // iOS insets the list for the tab bar; Android's tab bar floats over it (see AppTabs).
  const bottom = Platform.OS === 'ios' ? 0 : insets.bottom;
  const [refreshing, setRefreshing] = useState(false);
  const [displayTime, setDisplayTime] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setDisplayTime(Date.now());
    }, []),
  );
  const { data: session } = authClient.useSession();
  const feed = useInfiniteQuery({
    ...feedOptions(session?.user.id, authorId),
    enabled: Boolean(apiUrl),
  });
  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  if (!apiUrl) {
    return (
      <Feedback
        fullScreen
        message="接続先が未設定です。セットアップ後にタイムラインを利用できます。"
      />
    );
  }
  if (feed.isPending) {
    return <Feedback fullScreen loading message="投稿を読み込んでいます" />;
  }
  if (feed.isError && !feed.data) {
    return (
      <Feedback
        fullScreen
        message="投稿を読み込めませんでした。通信状況を確認してお試しください。"
        onRetry={() => {
          void feed.refetch();
        }}
      />
    );
  }
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: header ? 0 : 8, paddingBottom: bottom + 24 }}
      data={items}
      keyExtractor={(item) => item.id}
      testID="timeline"
      refreshing={refreshing}
      onRefresh={() => {
        setDisplayTime(Date.now());
        setRefreshing(true);
        void feed.refetch().then(
          () => {
            setRefreshing(false);
          },
          () => {
            setRefreshing(false);
          },
        );
      }}
      ListHeaderComponent={
        <>
          {header}
          {feed.isError ? (
            <Feedback
              message="投稿を読み込めませんでした。通信状況を確認してお試しください。"
              onRetry={() => {
                void feed.refetch();
              }}
            />
          ) : null}
        </>
      }
      ListEmptyComponent=<Feedback message="まだ投稿がありません" />
      renderItem={({ item }) => (
        <PostRow item={item} viewerId={session?.user.id} now={displayTime} />
      )}
      ListFooterComponent={
        feed.hasNextPage ? (
          <Button
            variant="ghost"
            className="m-4"
            disabled={feed.isFetchingNextPage}
            onPress={() => {
              void feed.fetchNextPage();
            }}
          >
            <Text>{feed.isFetchingNextPage ? '読み込み中…' : 'もっと見る'}</Text>
          </Button>
        ) : undefined
      }
    />
  );
}
