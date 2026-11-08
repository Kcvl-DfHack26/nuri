import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function feedOptions(userId?: string, author?: string) {
  return infiniteQueryOptions({
    queryKey: ['posts', userId, author],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.api.posts.$get(
        { query: { offset: String(pageParam), ...(author ? { author } : {}) } },
        { init: { signal } },
      );
      if (!response.ok) {
        throw new Error('投稿を読み込めませんでした。通信状況を確認してお試しください。');
      }
      return await response.json();
    },
    getNextPageParam: (last) => last.nextOffset,
  });
}

export async function changeLike(id: string, liked: boolean) {
  const endpoint = api.api.posts[':id'].like;
  const response = liked
    ? await endpoint.$delete({ param: { id } })
    : await endpoint.$put({ param: { id } });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'ログインし直してください。' : 'いいねを変更できませんでした。',
    );
  }
}

export async function deletePost(id: string) {
  const response = await api.api.posts[':id'].$delete({ param: { id } });
  if (!response.ok) {
    throw new Error('投稿を削除できませんでした。もう一度お試しください。');
  }
}

export type FeedPage = InferResponseType<typeof api.api.posts.$get, 200>;
export type Post = FeedPage['items'][number];
export type FeedData = InfiniteData<FeedPage, number>;

// Preserve every unaffected post reference so memoized rows can skip rendering.
export function updateFeedPost(
  data: FeedData | undefined,
  id: string,
  update: (post: Post) => Post,
): FeedData | undefined {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.items.some((item) => item.id === id)
        ? { ...page, items: page.items.map((item) => (item.id === id ? update(item) : item)) }
        : page,
    ),
  };
}

export const userKeys = { all: ['user'] as const };

/** A user's profile with follow counts (⑤'s author, other profiles, ⑰). */
export function userOptions(id: string) {
  return queryOptions({
    queryKey: [...userKeys.all, id],
    queryFn: async ({ signal }) => {
      const response = await api.api.users[':id'].$get({ param: { id } }, { init: { signal } });
      if (response.status !== 200) {
        throw new Error('プロフィールを読み込めませんでした。');
      }
      return (await response.json()).user;
    },
  });
}

export type UserProfile = InferResponseType<(typeof api.api.users)[':id']['$get'], 200>['user'];

export async function changeFollow(id: string, following: boolean) {
  const endpoint = api.api.users[':id'].follow;
  const response = following
    ? await endpoint.$delete({ param: { id } })
    : await endpoint.$put({ param: { id } });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'ログインし直してください。' : 'フォローを変更できませんでした。',
    );
  }
}

/**
 * Shows the viewer as following `id` or not: the followee's cached profile flips and its follower
 * count moves by one, and so does the viewer's following count. Nothing changes when the cached
 * profile already shows that state, so a retry or a second tap never counts twice. Returns
 * whether it changed, for the rollback.
 */
export function setCachedFollow(
  client: QueryClient,
  id: string,
  viewerId: string,
  following: boolean,
) {
  const step = following ? 1 : -1;
  const followee = client.getQueryData(userOptions(id).queryKey);
  if (!followee || followee.following === following) {
    return false;
  }
  client.setQueryData(userOptions(id).queryKey, {
    ...followee,
    following,
    followerCount: Math.max(0, followee.followerCount + step),
  });
  client.setQueryData(
    userOptions(viewerId).queryKey,
    (viewer) => viewer && { ...viewer, followingCount: Math.max(0, viewer.followingCount + step) },
  );
  return true;
}
