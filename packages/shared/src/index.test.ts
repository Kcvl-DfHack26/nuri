import { expect, test } from 'bun:test';

import {
  postAnalysisSchema,
  postAnalysisVideoMaxBytes,
  feedQuerySchema,
  profileInputSchema,
  profilePatchSchema,
  makeupShapeSchema,
  productKindImage,
  purchaseUrlSchema,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
  recipeSearchMaxLength,
  recipeThumbnailMaxBytes,
} from './index';

test('bounds pagination and profile input', () => {
  expect(feedQuerySchema.parse({})).toEqual({ offset: 0 });
  for (const offset of ['-1', '1.5', '10001', 'NaN']) {
    expect(feedQuerySchema.safeParse({ offset }).success).toBe(false);
  }
  expect(profileInputSchema.safeParse({ name: ' ' }).success).toBe(false);
  const valid = {
    name: ' はなこ ',
    handle: 'hanako_1',
    bio: 'こんにちは',
    isPublic: false,
    faceType: null,
  };
  expect(profileInputSchema.parse(valid).name).toBe('はなこ');
  expect(profileInputSchema.safeParse({ ...valid, handle: 'Hana' }).success).toBe(false);
  expect(profileInputSchema.safeParse({ ...valid, bio: 'あ'.repeat(43) }).success).toBe(false);
  expect(profilePatchSchema.safeParse({}).success).toBe(false);
  expect(profilePatchSchema.safeParse({ name: '更新' }).success).toBe(true);
  // Only the five diagnosed face types or none; no skin tone.
  expect(profilePatchSchema.safeParse({ faceType: 'round' }).success).toBe(true);
  expect(profilePatchSchema.safeParse({ faceType: null }).success).toBe(true);
  expect(profilePatchSchema.safeParse({ faceType: 'round_yellow' }).success).toBe(false);
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

test('accepts an analysis only with fixed words for the painted areas', () => {
  const step = {
    start: 4,
    end: 18,
    part: 'brow',
    description: '眉尻を描き足す',
    color: '#5A3D2B',
    regions: [
      {
        detail: '眉山から眉尻',
        side: 'screenRight',
        start: 'browPeak',
        end: 'browTail',
        shape: 'line',
        length: 'none',
        direction: 'none',
        clip: 'brow',
      },
    ],
    cosmetics: [],
  };
  const analysis = { title: '眉', summary: '', steps: [step], cosmetics: [] };
  expect(postAnalysisSchema.safeParse(analysis).success).toBe(true);
  const numbered = { ...step, regions: [{ ...step.regions[0], start: 105 }] };
  expect(postAnalysisSchema.safeParse({ ...analysis, steps: [numbered] }).success).toBe(false);
  const millimetres = { ...step, regions: [{ ...step.regions[0], length: 5 }] };
  expect(postAnalysisSchema.safeParse({ ...analysis, steps: [millimetres] }).success).toBe(false);
  // A step's color is #RRGGBB or unknown (#203).
  expect(
    postAnalysisSchema.safeParse({ ...analysis, steps: [{ ...step, color: null }] }).success,
  ).toBe(true);
  expect(
    postAnalysisSchema.safeParse({ ...analysis, steps: [{ ...step, color: 'black' }] }).success,
  ).toBe(false);
  expect(postAnalysisVideoMaxBytes).toBeLessThan(32 * 1024 * 1024);
});

test('accepts makeup shapes on canonical landmarks and needs an area for a fill', () => {
  const brow = [{ at: 70 }, { at: 105 }, { at: 107, dy: -0.01 }];
  expect(
    makeupShapeSchema.safeParse({ strokes: [{ fill: true, mirror: true, points: brow }] }).success,
  ).toBe(true);
  for (const strokes of [
    [],
    [{ fill: true, points: [{ at: 105 }] }],
    [{ points: [{ at: 468 }] }],
    [{ points: [{ at: 105, dx: 0.5 }] }],
  ]) {
    expect(makeupShapeSchema.safeParse({ strokes }).success).toBe(false);
  }
});

test('picks one photo per kind of cosmetic, shading and highlight sharing one', () => {
  expect(productKindImage('lip')).toBe('/product-kinds/lip.jpg');
  expect(productKindImage('shading')).toBe('/product-kinds/highlight-shading.jpg');
  expect(productKindImage('highlight')).toBe('/product-kinds/highlight-shading.jpg');
  expect(productKindImage('base')).toBeNull();
});
