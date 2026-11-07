import { afterAll, expect, test } from 'bun:test';
import { count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { seedSampleData } from './db/sample-data';
import { recipe, recipeProduct, user } from './db/schema';
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
  await db.delete(user).where(eq(user.id, ownUserId));
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
});

test('lists and shows recipes without a session', async () => {
  await seedSampleData(db);
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
        { id: 'celane-brow-pencil', usage: '眉・モカブラウン', purchasable: false },
        { id: 'mousse-cheek', usage: 'チーク・コーラル', purchasable: true },
      ],
    },
  });
  expect((await app.request('/api/recipes/missing-recipe')).status).toBe(404);
});
