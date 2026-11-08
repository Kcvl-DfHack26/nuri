import { createTestQueryClient } from '@/lib/test/query-client';

import {
  favoriteListOptions,
  formatCount,
  holdsRecipe,
  recipeKeys,
  recipeListOptions,
  recipeOptions,
  recipePartsOptions,
  setCachedFavorite,
} from './recipes';

jest.mock('@/lib/api', () => ({ api: {} }));

test('formats counts like Plan A', () => {
  expect(formatCount(0)).toBe('0');
  expect(formatCount(864)).toBe('864');
  expect(formatCount(1000)).toBe('1k');
  expect(formatCount(1200)).toBe('1.2k');
  expect(formatCount(1299)).toBe('1.2k');
  expect(formatCount(3400)).toBe('3.4k');
});

test('recipe query prefixes invalidate the corresponding cached data', async () => {
  const client = createTestQueryClient();
  const list = recipeListOptions({ part: 'brow', q: '時短' }).queryKey;
  const detail = recipeOptions('fox').queryKey;
  const parts = recipePartsOptions.queryKey;
  const favorites = [favoriteListOptions('one').queryKey, favoriteListOptions('two').queryKey];
  client.setQueryData(list, { pages: [], pageParams: [] });
  client.setQueryData(detail, null);
  client.setQueryData(parts, []);
  for (const key of favorites) {
    client.setQueryData(key, { pages: [], pageParams: [] });
  }
  client.setQueryData(['posts'], []);

  const invalidatedKeys = () =>
    client
      .getQueryCache()
      .findAll({ predicate: ({ state }) => state.isInvalidated })
      .map(({ queryKey }) => queryKey);

  await client.invalidateQueries({ queryKey: recipeKeys.favorites });
  expect(invalidatedKeys()).toEqual(favorites);

  await client.invalidateQueries({ queryKey: recipeKeys.all });
  expect(invalidatedKeys()).toEqual([list, detail, parts, ...favorites]);
});

test('flips one recipe in every cached copy once and keeps other rows', () => {
  const client = createTestQueryClient();
  const fox = { id: 'fox', favorited: false, likeCount: 1200 };
  const cat = { id: 'cat', favorited: false, likeCount: 5 };
  const listKey = [...recipeKeys.lists, 'whole'];
  client.setQueryData(listKey, {
    pages: [
      { items: [fox], nextOffset: 1 },
      { items: [cat], nextOffset: null },
    ],
    pageParams: [0, 1],
  });
  // ⑤'s cache entry, written under its plain key to keep the fixture small.
  client.setQueryData([...recipeKeys.all, 'detail', 'fox'], { ...fox, title: '狐メイク' });
  const before = client.getQueryData<{ pages: { items: unknown[] }[] }>(listKey);

  setCachedFavorite(client, 'fox', true);
  setCachedFavorite(client, 'fox', true);
  const after = client.getQueryData<{ pages: { items: (typeof fox)[] }[] }>(listKey);
  expect(after?.pages[0]?.items[0]).toEqual({ id: 'fox', favorited: true, likeCount: 1201 });
  expect(after?.pages[1]).toBe(before?.pages[1]);
  expect(client.getQueryData(recipeOptions('fox').queryKey)).toMatchObject({
    favorited: true,
    likeCount: 1201,
  });

  setCachedFavorite(client, 'fox', false);
  expect(client.getQueryData<typeof after>(listKey)?.pages[0]?.items[0]).toEqual(fox);
});

test('rolls back only the caches a change touched', () => {
  const client = createTestQueryClient();
  const listKey = [...recipeKeys.lists, 'whole'];
  client.setQueryData(listKey, {
    pages: [{ items: [{ id: 'fox', favorited: false, likeCount: 3 }], nextOffset: null }],
    pageParams: [0],
  });
  // ⑤ already shows the favorite, e.g. from a newer fetch.
  client.setQueryData([...recipeKeys.all, 'detail', 'fox'], {
    id: 'fox',
    favorited: true,
    likeCount: 4,
  });
  const changed = setCachedFavorite(client, 'fox', true);
  expect(changed).toEqual([listKey]);

  setCachedFavorite(client, 'fox', false, changed);
  expect(client.getQueryData(recipeOptions('fox').queryKey)).toMatchObject({
    favorited: true,
    likeCount: 4,
  });
  expect(
    client.getQueryData<{ pages: { items: unknown[] }[] }>(listKey)?.pages[0]?.items[0],
  ).toEqual({ id: 'fox', favorited: false, likeCount: 3 });
});

test('finds a recipe in a cached list or ⑤', () => {
  const list = { pages: [{ items: [{ id: 'cat' }] }, { items: [{ id: 'fox' }] }] };
  expect(holdsRecipe(list, 'fox')).toBe(true);
  expect(holdsRecipe(list, 'dog')).toBe(false);
  expect(holdsRecipe({ id: 'fox', title: '狐メイク' }, 'fox')).toBe(true);
  expect(holdsRecipe([{ part: 'brow', count: 6 }], 'fox')).toBe(false);
  expect(holdsRecipe(undefined, 'fox')).toBe(false);
});
