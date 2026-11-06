import { expect, test } from 'bun:test';

import { feedQuerySchema, postInputSchema, preferencesSchema, profileInputSchema } from './index';

test('trims posts and rejects empty or unbounded content', () => {
  expect(postInputSchema.parse({ body: '  こんにちは  ' }).body).toBe('こんにちは');
  for (const body of ['', '  ', 'あ'.repeat(501)]) {
    expect(postInputSchema.safeParse({ body }).success).toBe(false);
  }
  expect(postInputSchema.safeParse({ body: 'あ'.repeat(500) }).success).toBe(true);
});
test('bounds pagination and profile input', () => {
  expect(feedQuerySchema.parse({})).toEqual({ offset: 0 });
  for (const offset of ['-1', '1.5', '10001', 'NaN']) {
    expect(feedQuerySchema.safeParse({ offset }).success).toBe(false);
  }
  expect(profileInputSchema.safeParse({ name: ' ' }).success).toBe(false);
  expect(profileInputSchema.parse({ name: ' はなこ ' }).name).toBe('はなこ');
});
test('preserves appearance preferences while removing obsolete ritual data', () => {
  expect(preferencesSchema.parse({ appearance: 'dark', favorites: ['old'] })).toEqual({
    appearance: 'dark',
    haptics: true,
  });
  expect(preferencesSchema.safeParse({ appearance: 'unknown' }).success).toBe(false);
});
