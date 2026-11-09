import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

import { hashKey, infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { Share } from 'react-native';

import { api } from '@/lib/api';
import { requireSignedInMutationOk } from '@/lib/api-errors';

const allRecipes = ['recipes'] as const;
export const recipeKeys = {
  all: allRecipes,
  lists: [...allRecipes, 'list'] as const,
  favorites: [...allRecipes, 'favorites'] as const,
};

type RecipeListFilters = Omit<InferRequestType<typeof api.api.recipes.$get>['query'], 'offset'>;

/**
 * Whole-face recipes (①); with `part`, the recipes for that part (③); with `author`, the recipes
 * that user wrote (⑰); with `q`, the recipes of every kind whose title or a tag contains it.
 */
export function recipeListOptions({ part, author, q }: RecipeListFilters = {}) {
  return infiniteQueryOptions({
    queryKey: [...recipeKeys.lists, part ?? 'whole', author, q],
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
  queryKey: [...recipeKeys.all, 'parts'],
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
    queryKey: [...recipeKeys.favorites, userId],
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
  requireSignedInMutationOk(response, 'お気に入りを変更できませんでした。');
}

/** Whether a cached recipe list or ⑤ holds the recipe with this ID. */
export function holdsRecipe(data: unknown, id: string) {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  if ('pages' in data && Array.isArray(data.pages)) {
    return data.pages.some(
      (page: Partial<RecipePage>) => page.items?.some((item) => item.id === id) ?? false,
    );
  }
  return 'id' in data && data.id === id;
}

/**
 * Shows one recipe as favorited or not in every cached list and its ⑤, with the heart's count
 * moved by one, and returns the keys of the caches it changed. Given `only`, it changes just
 * those, so a rollback restores exactly what the change touched. Copies already in that state,
 * other recipes and untouched pages keep their references.
 */
export function setCachedFavorite(
  client: QueryClient,
  id: string,
  favorited: boolean,
  only?: readonly QueryKey[],
): QueryKey[] {
  const changed: QueryKey[] = [];
  const allowed = (key: QueryKey) => !only || only.some((other) => hashKey(other) === hashKey(key));
  const stale = (item: { id: string; favorited: boolean }) =>
    item.id === id && item.favorited !== favorited;
  const flip = <T extends { id: string; favorited: boolean; likeCount: number }>(item: T): T =>
    stale(item)
      ? { ...item, favorited, likeCount: Math.max(0, item.likeCount + (favorited ? 1 : -1)) }
      : item;
  for (const queryKey of [recipeKeys.lists, recipeKeys.favorites]) {
    for (const [key, data] of client.getQueriesData<InfiniteData<RecipePage>>({ queryKey })) {
      if (data?.pages.some((page) => page.items.some(stale)) && allowed(key)) {
        changed.push(key);
        client.setQueryData<InfiniteData<RecipePage>>(key, {
          ...data,
          pages: data.pages.map((page) =>
            page.items.some(stale) ? { ...page, items: page.items.map(flip) } : page,
          ),
        });
      }
    }
  }
  const detailKey = recipeOptions(id).queryKey;
  const detail = client.getQueryData(detailKey);
  if (detail && stale(detail) && allowed(detailKey)) {
    changed.push(detailKey);
    client.setQueryData(detailKey, flip(detail));
  }
  return changed;
}

export type RecipeInput = InferRequestType<typeof api.api.recipes.$post>['json'];

const postErrors: Partial<Record<number, string>> = {
  400: '投稿の内容を確認してください。',
  401: 'ログインし直してください。',
  409: '投稿できませんでした。投稿をやり直してください。',
  413: 'サムネイルの写真が大きすぎます。別の場面を選んでください。',
};

/** Saves a recipe posted from ③ (⑫-8) and returns its ID. */
export async function postRecipe(json: RecipeInput) {
  let response;
  try {
    response = await api.api.recipes.$post({ json });
  } catch {
    throw new Error('投稿できませんでした。通信状況を確認してお試しください。');
  }
  if (response.status === 201) {
    return (await response.json()).id;
  }
  throw new Error(
    postErrors[response.status] ?? '投稿できませんでした。時間をおいてお試しください。',
  );
}

export function recipeOptions(id: string) {
  return queryOptions({
    queryKey: [...recipeKeys.all, 'detail', id],
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

/** Plan A's compact counts: 864, 1.2k, 3.4k. */
export function formatCount(value: number) {
  if (value < 1000) {
    return String(value);
  }
  const thousands = Math.floor(value / 100) / 10;
  return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
}

/**
 * Opens the OS share sheet with a line about the recipe, e.g. from ⑤ or ⑩. Only this text is
 * shared: never a photo of the user's face.
 */
export function shareRecipe(
  recipe: Pick<RecipeDetail, 'title' | 'author'>,
  verb: '見つけました' | '試しました',
) {
  void Share.share({ message: `${recipe.title}（${recipe.author.name}）をnuriで${verb}` }).catch(
    () => undefined,
  );
}
