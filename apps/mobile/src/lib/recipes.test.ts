import { createTestQueryClient } from '@/lib/test/query-client';

import {
  favoriteListOptions,
  formatCount,
  recipeKeys,
  recipeListOptions,
  recipeOptions,
  recipePartsOptions,
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
