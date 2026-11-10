import { makeupShapeSchema } from '@starter/shared';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { count, eq, inArray } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { recipe, recipeProduct, recipeStep, user } from './db/schema';
import { createAuth } from './modules/auth';
import { readEnv, storageEnvSchema } from './platform/env';
import { createImageStore } from './platform/images';
import { seedSampleData } from './sample-data';

const env = readEnv({
  ...storageEnvSchema.parse(process.env),
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: 'integration-test-secret-never-use-in-production',
  BETTER_AUTH_URL: 'http://localhost:8080',
  TRUSTED_ORIGINS: 'http://localhost:8081,com.kcvl.nuri://',
});
const { db, pool } = connectDatabase(env.DATABASE_URL);
const images = createImageStore(env);
const app = createApp(db, createAuth(db, env), env, () => Promise.resolve());
const unique = crypto.randomUUID();
const ownUserId = `recipe-test-${unique}`;
const ownRecipeId = `own-${unique}`;

beforeAll(async () => {
  await seedSampleData(db, images);
});

afterAll(async () => {
  try {
    // Deleting the test user also deletes its recipes, including the borrowed slug; reseed it.
    await db.delete(user).where(eq(user.id, ownUserId));
    await seedSampleData(db, images);
  } finally {
    await pool.end();
  }
});

test('the seed is idempotent and keeps recipes created outside it', async () => {
  await db
    .insert(user)
    .values({ id: ownUserId, name: 'てすと', email: `${ownUserId}@example.com` });
  await db.insert(recipe).values({
    id: ownRecipeId,
    authorId: ownUserId,
    title: '自分のレシピ',
    image: 'https://example.com/own.jpg',
    durationMinutes: 3,
  });
  // Someone else's recipe that happens to use a seeded slug.
  await db
    .update(recipe)
    .set({ authorId: ownUserId, title: '同じIDの自分のレシピ' })
    .where(eq(recipe.id, 'round'));
  const ownStep = {
    recipeId: 'round',
    position: 0,
    part: 'lip' as const,
    label: 'リップ',
    title: '自分の手順',
    hint: '自分の補足',
    product: 'リップ',
    colors: ['#C0505A'],
    shape: null,
  };
  await db.insert(recipeStep).values(ownStep);
  const before = await db.select({ value: count() }).from(recipe);
  const seededProducts = await db
    .select({ value: count() })
    .from(recipeProduct)
    .where(eq(recipeProduct.recipeId, 'fox'));

  await seedSampleData(db, images);

  expect(await db.select({ value: count() }).from(recipe)).toEqual(before);
  expect(
    await db
      .select({ value: count() })
      .from(recipeProduct)
      .where(eq(recipeProduct.recipeId, 'fox')),
  ).toEqual(seededProducts);
  expect(
    await db
      .select({ id: recipe.id })
      .from(recipe)
      .where(inArray(recipe.id, [ownRecipeId, 'fox'])),
  ).toHaveLength(2);
  expect(
    await db.select({ title: recipe.title }).from(recipe).where(eq(recipe.id, 'round')),
  ).toEqual([{ title: '同じIDの自分のレシピ' }]);
  // The seed neither rewrites nor removes steps of a recipe it does not own.
  expect(await db.select().from(recipeStep).where(eq(recipeStep.recipeId, 'round'))).toEqual([
    ownStep,
  ]);
  expect(
    await db.select({ value: count() }).from(recipeStep).where(eq(recipeStep.recipeId, 'fox')),
  ).toEqual([{ value: 8 }]);
});

test('keeps seed image references on upload failure and preserves edited avatars on reseed', async () => {
  const legacy = '/sample-avatars/haru.jpg';
  const custom = '/media/profiles/changed.jpg';
  const sampleHaru = eq(user.id, 'sample-haru');
  const sampleMio = eq(user.id, 'sample-mio');
  const [beforeHaru] = await db.select({ image: user.image }).from(user).where(sampleHaru);
  const [beforeMio] = await db.select({ image: user.image }).from(user).where(sampleMio);
  if (!beforeHaru || !beforeMio) {
    throw new Error('Expected both sample users to exist');
  }
  try {
    await db.update(user).set({ image: legacy }).where(sampleHaru);
    await db.update(user).set({ image: custom }).where(sampleMio);
    const missingBucket = createImageStore({ ...env, GCS_BUCKET: `missing-${unique}` });
    const failure = await seedSampleData(db, missingBucket).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 404 });
    expect(await db.select({ image: user.image }).from(user).where(sampleHaru)).toEqual([
      { image: legacy },
    ]);

    await seedSampleData(db, images);
    expect(await db.select({ image: user.image }).from(user).where(sampleHaru)).toEqual([
      { image: '/media/sample-avatars/haru.jpg' },
    ]);
    expect(await db.select({ image: user.image }).from(user).where(sampleMio)).toEqual([
      { image: custom },
    ]);
  } finally {
    await db.update(user).set(beforeHaru).where(sampleHaru);
    await db.update(user).set(beforeMio).where(sampleMio);
  }
});

test('shows the public recipe with ordered products and steps', async () => {
  const detail = await app.request('/api/recipes/fox');
  expect(detail.status).toBe(200);
  const body: unknown = await detail.json();
  expect(body).toMatchObject({
    recipe: {
      id: 'fox',
      title: '狐メイク',
      image: '/media/sample-recipes/fox.jpg',
      tags: ['丸顔向け'],
      durationMinutes: 15,
      source: 'instagram',
      favorited: false,
      author: { name: 'mio', image: '/media/sample-avatars/mio.png' },
      products: [
        {
          id: 'celane-brow-pencil',
          usage: '眉・モカブラウン',
          image: '/media/sample-recipes/product-brow-pencil.jpg',
          purchaseUrl: null,
        },
        {
          id: 'mousse-cheek',
          usage: 'チーク・コーラル',
          purchaseUrl:
            'https://www.amazon.co.jp/s?k=%E3%83%A0%E3%83%BC%E3%82%B9%E3%83%81%E3%83%BC%E3%82%AF',
        },
      ],
    },
  });
  for (const [key, contentType] of [
    ['sample-avatars/mio.png', 'image/png'],
    ['sample-recipes/fox.jpg', 'image/jpeg'],
    ['sample-recipes/product-brow-pencil.jpg', 'image/jpeg'],
  ] as const) {
    const response = await app.request(`/media/${key}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(contentType);
    const [stored] = await images.file(key).getMetadata();
    expect(stored.contentType).toBe(contentType);
    const fixture = await readFile(new URL(`../assets/${key}`, import.meta.url));
    expect(Buffer.from(await response.arrayBuffer()).equals(fixture)).toBe(true);
    expect((await app.request(`/${key}`)).status).toBe(404);
  }
  expect((await app.request('/media/sample-recipes/missing.jpg')).status).toBe(404);

  const { recipe: fox } = z
    .object({
      recipe: z.object({
        steps: z.array(z.object({ part: z.string(), shape: makeupShapeSchema.nullable() })),
      }),
    })
    .parse(body);
  expect(fox.steps.map((step) => step.part)).toEqual([
    'brow',
    'eye',
    'eye',
    'highlight',
    'lash',
    'lash',
    'shading',
    'cheek',
  ]);
  // Every seeded step says where it paints.
  expect(fox.steps.every((step) => step.shape !== null)).toBe(true);
  expect(await (await app.request('/api/recipes/office')).json()).toMatchObject({
    recipe: { products: [], steps: [] },
  });
  expect((await app.request('/api/recipes/missing-recipe')).status).toBe(404);
});

test('lists whole-face recipes by default and part recipes by part', async () => {
  const schema = z.object({ items: z.array(z.object({ id: z.string() })) });
  const whole = schema.parse(await (await app.request('/api/recipes')).json());
  expect(whole.items.map((item) => item.id)).toContain('fox');
  expect(whole.items.map((item) => item.id)).not.toContain('brow-soft-arch');
  const brows = schema.parse(await (await app.request('/api/recipes?part=brow')).json());
  expect(brows.items.map((item) => item.id)).toContain('brow-soft-arch');
  expect(brows.items.map((item) => item.id)).not.toContain('fox');
  const counts = z
    .object({ items: z.array(z.object({ part: z.string().nullable(), count: z.number() })) })
    .parse(await (await app.request('/api/recipe-parts')).json());
  expect(counts.items.find((item) => item.part === 'brow')?.count).toBeGreaterThanOrEqual(6);
});

test('searches recipes of every kind by title and tag with paging', async () => {
  const schema = z.object({
    items: z.array(z.object({ id: z.string() })),
    nextOffset: z.number().nullable(),
  });
  const search = async (query: string) => {
    const response = await app.request(`/api/recipes?${query}`);
    expect(response.status).toBe(200);
    return schema.parse(await response.json());
  };
  // 丸顔向け tags whole-face recipes and a brow recipe; 猫 is in a title only.
  const round = (await search(`q=${encodeURIComponent('丸顔')}`)).items.map((item) => item.id);
  expect(round).toEqual(expect.arrayContaining(['fox', 'round', 'brow-arch']));
  expect(round).not.toContain('cat');
  expect((await search(`q=${encodeURIComponent(' 猫 ')}`)).items.map((item) => item.id)).toEqual([
    'cat',
  ]);
  const brows = await search(`q=${encodeURIComponent('初心者')}&part=brow`);
  expect(brows.items.map((item) => item.id)).toContain('brow-soft-arch');
  expect(brows.items.map((item) => item.id)).not.toContain('fox');

  const searchUserId = `recipe-search-${unique}`;
  const token = `token${unique.slice(0, 8)}`;
  await db
    .insert(user)
    .values({ id: searchUserId, name: 'けんさく', email: `${searchUserId}@example.com` });
  try {
    const matchingRecipes = Array.from({ length: 20 }, (_, index) => ({
      id: `search-${unique}-${String(index).padStart(2, '0')}`,
      authorId: searchUserId,
      title: `検索用${index}`,
      image: 'https://example.com/search.jpg',
      tags: [token.toUpperCase()],
      durationMinutes: 3,
    }));
    const wildcardId = `search-${unique}-wild`;
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await db.insert(recipe).values([
      ...matchingRecipes.map((row) => ({ ...row, createdAt })),
      {
        id: wildcardId,
        authorId: searchUserId,
        title: `100%_${token}`,
        image: 'https://example.com/search.jpg',
        part: 'lip',
        durationMinutes: 3,
        createdAt,
      },
    ]);
    // Equal timestamps require a stable ID tie-breaker across pages.
    const expectedIds = [wildcardId, ...matchingRecipes.map(({ id }) => id).reverse()];
    const first = await search(`q=${token}`);
    expect(first.items.map(({ id }) => id)).toEqual(expectedIds.slice(0, 20));
    expect(first.nextOffset).toBe(20);
    const second = await search(`q=${token}&offset=20`);
    expect(second.items.map(({ id }) => id)).toEqual(expectedIds.slice(20));
    expect(second.nextOffset).toBeNull();
    // LIKE wildcards in the term match literally.
    expect((await search(`q=${encodeURIComponent(`0%_${token}`)}`)).items).toHaveLength(1);
    expect((await search(`q=${encodeURIComponent(`1_0%_${token}`)}`)).items).toHaveLength(0);
    expect((await search(`q=${encodeURIComponent(`${token}%`)}`)).items).toHaveLength(0);
  } finally {
    await db.delete(user).where(eq(user.id, searchUserId));
  }
});
