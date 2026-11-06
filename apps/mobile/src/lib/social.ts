import type { InfiniteData } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { infiniteQueryOptions } from '@tanstack/react-query';

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
