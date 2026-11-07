import { afterAll, expect, test } from 'bun:test';
import { count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { seedSampleData } from './db/sample-data';
import { recipe, recipeProduct, recipeStep, user } from './db/schema';
import { createAuth } from './modules/auth';
import { readEnv } from './platform/env';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a migrated test database');
}
const { db, pool } = connectDatabase(databaseUrl);
const env = readEnv({
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: 'integration-test-secret-never-use-in-production',
  BETTER_AUTH_URL: 'http://localhost:8080',
  TRUSTED_ORIGINS: 'http://localhost:8081,com.kcvl.nuri://',
});
const app = createApp(db, createAuth(db, env), env, () => Promise.resolve());
const unique = crypto.randomUUID();
const ownUserId = `recipe-test-${unique}`;
const ownRecipeId = `own-${unique}`;

afterAll(async () => {
  // Deleting the test user also deletes its recipes, including the borrowed slug; reseed it.
  await db.delete(user).where(eq(user.id, ownUserId));
  await seedSampleData(db);
  await pool.end();
});

test('the seed is idempotent and keeps recipes created outside it', async () => {
  await seedSampleData(db);
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
  };
  await db.insert(recipeStep).values(ownStep);
  const before = await db.select({ value: count() }).from(recipe);
  const seededProducts = await db
    .select({ value: count() })
    .from(recipeProduct)
    .where(eq(recipeProduct.recipeId, 'fox'));

  await seedSampleData(db);

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
  ).toEqual([{ value: 5 }]);
});

test('lists and shows recipes without a session', async () => {
  const list = await app.request('/api/recipes');
  expect(list.status).toBe(200);
  const { items } = z
    .object({ items: z.array(z.object({ id: z.string() })) })
    .parse(await list.json());
  expect(items.map((item) => item.id)).toContain('fox');

  const detail = await app.request('/api/recipes/fox');
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({
    recipe: {
      id: 'fox',
      title: '狐メイク',
      tags: ['丸顔向け'],
      durationMinutes: 15,
      source: 'instagram',
      author: { name: 'mio', image: '/sample-avatars/mio.png' },
      products: [
        { id: 'celane-brow-pencil', usage: '眉・モカブラウン', purchaseUrl: null },
        {
          id: 'mousse-cheek',
          usage: 'チーク・コーラル',
          purchaseUrl:
            'https://www.amazon.co.jp/s?k=%E3%83%A0%E3%83%BC%E3%82%B9%E3%83%81%E3%83%BC%E3%82%AF',
        },
      ],
    },
  });
  const { recipe: fox } = z
    .object({ recipe: z.object({ steps: z.array(z.object({ part: z.string() })) }) })
    .parse(await (await app.request('/api/recipes/fox')).json());
  expect(fox.steps.map((step) => step.part)).toEqual(['brow', 'eye', 'lash', 'shading', 'cheek']);
  expect(await (await app.request('/api/recipes/cat')).json()).toMatchObject({
    recipe: { steps: [] },
  });
  expect((await app.request('/api/recipes/missing-recipe')).status).toBe(404);
});

test('lists whole-face recipes by default and part recipes by part', async () => {
  const schema = z.object({ items: z.array(z.object({ id: z.string() })) });
  const whole = schema.parse(await (await app.request('/api/recipes')).json());
  expect(whole.items.map((item) => item.id)).not.toContain('brow-soft-arch');
  const brows = schema.parse(await (await app.request('/api/recipes?part=brow')).json());
  expect(brows.items.map((item) => item.id)).toContain('brow-soft-arch');
  expect(brows.items.map((item) => item.id)).not.toContain('fox');
  expect((await app.request('/api/recipes?part=nose')).status).toBe(400);
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
    await db.insert(recipe).values([
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `search-${unique}-${index}`,
        authorId: searchUserId,
        title: `検索用${index}`,
        image: 'https://example.com/search.jpg',
        tags: [token.toUpperCase()],
        durationMinutes: 3,
      })),
      {
        id: `search-${unique}-wild`,
        authorId: searchUserId,
        title: `100%_${token}`,
        image: 'https://example.com/search.jpg',
        part: 'lip' as const,
        durationMinutes: 3,
      },
    ]);
    // Case-insensitive, across whole-face and part recipes, 20 per page.
    const first = await search(`q=${token}`);
    expect(first.items).toHaveLength(20);
    expect(first.nextOffset).toBe(20);
    const second = await search(`q=${token}&offset=20`);
    expect(second.items).toHaveLength(1);
    expect(second.nextOffset).toBeNull();
    // LIKE wildcards in the term match literally.
    expect((await search(`q=${encodeURIComponent(`0%_${token}`)}`)).items).toHaveLength(1);
    expect((await search(`q=${encodeURIComponent(`1_0%_${token}`)}`)).items).toHaveLength(0);
    expect((await search(`q=${encodeURIComponent(`${token}%`)}`)).items).toHaveLength(0);
  } finally {
    await db.delete(user).where(eq(user.id, searchUserId));
  }
  expect((await app.request('/api/recipes?q=%20')).status).toBe(400);
  expect((await app.request(`/api/recipes?q=${'a'.repeat(51)}`)).status).toBe(400);
});
