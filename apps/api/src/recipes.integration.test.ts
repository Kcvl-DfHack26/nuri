import { makeupShapeSchema } from '@starter/shared';
import { afterAll, expect, test } from 'bun:test';
import { count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { templateRecipeIds } from './db/recipe-templates';
import { seedSampleData } from './db/sample-data';
import { recipe, recipeFavorite, recipeProduct, recipeStep, user } from './db/schema';
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
  await db.insert(recipeFavorite).values({ userId: ownUserId, recipeId: 'fox' });
  // Someone else's recipe that happens to use a seeded slug.
  await db
    .update(recipe)
    .set({ authorId: ownUserId, title: '同じIDの自分のレシピ' })
    .where(eq(recipe.id, 'round'));
  await db.delete(recipeProduct).where(eq(recipeProduct.recipeId, 'round'));
  await db.delete(recipeStep).where(eq(recipeStep.recipeId, 'round'));
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
  await db
    .update(recipe)
    .set({ authorId: 'sample-mio', source: 'instagram', likeCount: 7 })
    .where(eq(recipe.id, 'fox'));
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
  ).toEqual([{ value: 6 }]);
  expect(
    await db
      .select({ authorId: recipe.authorId, source: recipe.source, likeCount: recipe.likeCount })
      .from(recipe)
      .where(eq(recipe.id, 'fox')),
  ).toEqual([{ authorId: 'nuri-editorial', source: null, likeCount: 0 }]);
  expect(
    await db
      .select({ recipeId: recipeFavorite.recipeId })
      .from(recipeFavorite)
      .where(eq(recipeFavorite.userId, ownUserId)),
  ).toEqual([{ recipeId: 'fox' }]);
  await db.delete(user).where(eq(user.id, ownUserId));
  await seedSampleData(db);
});

test('shows the public recipe with ordered products and steps', async () => {
  const detail = await app.request('/api/recipes/fox');
  expect(detail.status).toBe(200);
  const body: unknown = await detail.json();
  expect(body).toMatchObject({
    recipe: {
      id: 'fox',
      title: '狐メイク',
      tags: ['切れ長アイ'],
      durationMinutes: 15,
      source: null,
      favorited: false,
      author: { name: 'nuri' },
    },
  });
  const { recipe: fox } = z
    .object({
      recipe: z.object({
        products: z.array(
          z.object({ id: z.string(), usage: z.string(), purchaseUrl: z.nullable(z.url()) }),
        ),
        steps: z.array(z.object({ part: z.string(), shape: makeupShapeSchema.nullable() })),
      }),
    })
    .parse(body);
  expect(fox.products.slice(0, 2)).toEqual([
    { id: 'template-brow-powder', usage: '眉頭を淡くぼかす', purchaseUrl: null },
    { id: 'template-brow-pencil', usage: '髪色になじむブラウン', purchaseUrl: null },
  ]);
  expect(fox.steps.map((step) => step.part)).toEqual([
    'brow',
    'eye',
    'lash',
    'shading',
    'cheek',
    'lip',
  ]);
  // Every seeded step says where it paints.
  expect(fox.steps.every((step) => step.shape !== null)).toBe(true);
  const longBody: unknown = await (await app.request('/api/recipes/long')).json();
  const { recipe: longRecipe } = z
    .object({
      recipe: z.object({
        products: z.array(z.object({ id: z.string() })),
        steps: z.array(z.unknown()),
      }),
    })
    .parse(longBody);
  expect(longRecipe.products.map(({ id }) => id)).toContain('template-cheek');
  expect(longRecipe.steps).toHaveLength(5);
  expect((await app.request('/api/recipes/missing-recipe')).status).toBe(404);
});

test('all twelve editorial templates have usable products, colors and painted steps', async () => {
  expect(templateRecipeIds).toHaveLength(12);
  for (const id of templateRecipeIds) {
    const response = await app.request(`/api/recipes/${id}`);
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const { recipe: item } = z
      .object({
        recipe: z.object({
          source: z.null(),
          products: z.array(z.object({ id: z.string() })).min(1),
          steps: z
            .array(
              z.object({
                colors: z.array(z.string().regex(/^#[0-9A-F]{6}$/)).min(1),
                shape: makeupShapeSchema,
              }),
            )
            .min(1),
        }),
      })
      .parse(body);
    expect(item.products.length).toBeGreaterThanOrEqual(1);
  }
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
  // 丸顔向け tags a whole-face recipe and a brow recipe; 猫 is in a title only.
  const round = (await search(`q=${encodeURIComponent('丸顔')}`)).items.map((item) => item.id);
  expect(round).toEqual(expect.arrayContaining(['round', 'brow-arch']));
  expect(round).not.toContain('fox');
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
