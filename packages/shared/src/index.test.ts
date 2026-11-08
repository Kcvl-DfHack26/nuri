import { expect, test } from 'bun:test';

import {
  feedQuerySchema,
  postInputSchema,
  preferencesSchema,
  profileInputSchema,
  profilePatchSchema,
  purchaseUrlSchema,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
  recipeSearchMaxLength,
  recipeThumbnailMaxBytes,
} from './index';

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
  const valid = { name: ' はなこ ', handle: 'hanako_1', bio: 'こんにちは', isPublic: false };
  expect(profileInputSchema.parse(valid).name).toBe('はなこ');
  expect(profileInputSchema.safeParse({ ...valid, handle: 'Hana' }).success).toBe(false);
  expect(profileInputSchema.safeParse({ ...valid, bio: 'あ'.repeat(43) }).success).toBe(false);
  expect(profilePatchSchema.safeParse({}).success).toBe(false);
  expect(profilePatchSchema.safeParse({ name: '更新' }).success).toBe(true);
});
test('preserves appearance preferences while removing obsolete ritual data', () => {
  expect(preferencesSchema.parse({ appearance: 'dark', favorites: ['old'] })).toEqual({
    appearance: 'dark',
    haptics: true,
  });
  expect(preferencesSchema.safeParse({ appearance: 'unknown' }).success).toBe(false);
});
test('accepts only slug recipe IDs and bounded recipe searches', () => {
  expect(recipeParamsSchema.parse({ id: 'fox' }).id).toBe('fox');
  for (const id of ['', 'Fox', 'a b', '../fox', 'a'.repeat(65)]) {
    expect(recipeParamsSchema.safeParse({ id }).success).toBe(false);
  }
  expect(recipeListQuerySchema.parse({})).toEqual({ offset: 0 });
  expect(recipeListQuerySchema.parse({ part: 'brow', q: ' 猫 ' })).toEqual({
    offset: 0,
    part: 'brow',
    q: '猫',
  });
  expect(recipeListQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
  expect(recipeListQuerySchema.safeParse({ part: 'nose' }).success).toBe(false);
  expect(recipeListQuerySchema.safeParse({ q: '猫'.repeat(recipeSearchMaxLength) }).success).toBe(
    true,
  );
  for (const q of [' ', '猫'.repeat(recipeSearchMaxLength + 1)]) {
    expect(recipeListQuerySchema.safeParse({ q }).success).toBe(false);
  }
});
test('accepts only https shop links', () => {
  expect(purchaseUrlSchema.safeParse('https://www.amazon.co.jp/s?k=cheek').success).toBe(true);
  for (const url of ['http://shop.example.com', 'data:text/html,shop', 'https://localhost/']) {
    expect(purchaseUrlSchema.safeParse(url).success).toBe(false);
  }
});

test('bounds a posted recipe and accepts only a JPEG thumbnail within the limit', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]).toString('base64');
  const step = {
    part: 'cheek',
    label: 'チーク',
    title: ' チーク ',
    description: '',
    uses: 'チーク',
    color: '#E8968A',
  };
  const valid = {
    key: '3f2b8c1e-6d4a-4b7e-9c2d-1a5e8f0b7c3d',
    title: ' 狐メイク ',
    summary: '',
    tags: ['時短'],
    durationMinutes: 3,
    steps: [step],
    thumbnail: jpeg,
  };
  const parsed = recipeInputSchema.parse(valid);
  expect(parsed.title).toBe('狐メイク');
  expect(parsed.steps[0]?.title).toBe('チーク');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
  const oversized = jpeg.slice(0, 4) + 'A'.repeat(Math.ceil(recipeThumbnailMaxBytes / 3) * 4);
  for (const change of [
    { title: '  ' },
    { title: 'あ'.repeat(41) },
    { steps: [] },
    { steps: Array.from({ length: 21 }, () => step) },
    { steps: [{ ...step, part: 'nose' }] },
    { steps: [{ ...step, color: 'red' }] },
    { thumbnail: png },
    { thumbnail: 'not base64!' },
    { thumbnail: oversized },
  ]) {
    expect(recipeInputSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  }
});
