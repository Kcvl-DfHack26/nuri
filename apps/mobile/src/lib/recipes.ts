import type { InferResponseType } from 'hono/client';

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function recipeListOptions() {
  return infiniteQueryOptions({
    queryKey: ['recipes', 'list'],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.api.recipes.$get(
        { query: { offset: String(pageParam) } },
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

export type RecipeSummary = InferResponseType<typeof api.api.recipes.$get, 200>['items'][number];
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
