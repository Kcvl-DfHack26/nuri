import type { makeupParts } from '@starter/shared';
import type { InferResponseType } from 'hono/client';

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

type PartId = (typeof makeupParts)[number];

/**
 * Whole-face recipes (①); with `part`, the recipes for that part (③); with `author`, the recipes
 * that user wrote (⑰); with `q`, the recipes of every kind whose title or a tag contains it.
 */
export function recipeListOptions({
  part,
  author,
  q,
}: { part?: PartId; author?: string; q?: string } = {}) {
  return infiniteQueryOptions({
    queryKey: ['recipes', 'list', part ?? 'whole', author, q],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.api.recipes.$get(
        {
          query: {
            offset: String(pageParam),
            ...(part ? { part } : {}),
            ...(author ? { author } : {}),
            ...(q ? { q } : {}),
          },
        },
        { init: { signal } },
      );
      if (!response.ok) {
        throw new Error('レシピを読み込めませんでした。通信状況を確認してお試しください。');
      }
      return await response.json();
    },
    getNextPageParam: (last) => last.nextOffset,
  });
}

/** How many recipes each part has (②). */
export const recipePartsOptions = queryOptions({
  queryKey: ['recipes', 'parts'],
  queryFn: async ({ signal }) => {
    const response = await api.api['recipe-parts'].$get({}, { init: { signal } });
    if (!response.ok) {
      throw new Error('部位のレシピを読み込めませんでした。');
    }
    return (await response.json()).items;
  },
});

/** The signed-in user's favorite recipes, most recently added first (⑰). */
export function favoriteListOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: ['recipes', 'favorites', userId],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.api.me.favorites.$get(
        { query: { offset: String(pageParam) } },
        { init: { signal } },
      );
      if (!response.ok) {
        throw new Error('お気に入りを読み込めませんでした。通信状況を確認してお試しください。');
      }
      return await response.json();
    },
    getNextPageParam: (last) => last.nextOffset,
  });
}

export async function changeFavorite(id: string, favorited: boolean) {
  const endpoint = api.api.recipes[':id'].favorite;
  const response = favorited
    ? await endpoint.$delete({ param: { id } })
    : await endpoint.$put({ param: { id } });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'ログインし直してください。' : 'お気に入りを変更できませんでした。',
    );
  }
}

export function recipeOptions(id: string) {
  return queryOptions({
    queryKey: ['recipes', 'detail', id],
    queryFn: async ({ signal }) => {
      const response = await api.api.recipes[':id'].$get({ param: { id } }, { init: { signal } });
      // null is a recipe that does not exist; 400 is an ID that never can, e.g. a broken link.
      if (response.status === 404 || response.status === 400) {
        return null;
      }
      if (!response.ok) {
        throw new Error('レシピを読み込めませんでした。通信状況を確認してお試しください。');
      }
      return (await response.json()).recipe;
    },
  });
}

export type RecipePage = InferResponseType<typeof api.api.recipes.$get, 200>;
export type RecipeSummary = RecipePage['items'][number];
export type RecipeDetail = InferResponseType<
  (typeof api.api.recipes)[':id']['$get'],
  200
>['recipe'];
export type RecipeStep = RecipeDetail['steps'][number];

export const sourceLabels: Record<NonNullable<RecipeDetail['source']>, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

/** Plan A's compact counts: 864, 1.2k, 3.4k. */
export function formatCount(value: number) {
  if (value < 1000) {
    return String(value);
  }
  const thousands = Math.floor(value / 100) / 10;
  return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
}
