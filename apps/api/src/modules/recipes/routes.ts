import { zValidator } from '@hono/zod-validator';
import { feedQuerySchema, recipeListQuerySchema, recipeParamsSchema } from '@starter/shared';
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { product, recipe, recipeFavorite, recipeProduct, recipeStep, user } from '../../db/schema';
import { requireSession } from '../auth';

const pageSize = 20;
const summaryFields = {
  id: recipe.id,
  title: recipe.title,
  image: recipe.image,
  tags: recipe.tags,
  summary: recipe.summary,
  likeCount: recipe.likeCount,
  author: { id: user.id, name: user.name },
};

function page<T>(items: T[], offset: number) {
  return {
    items: items.slice(0, pageSize),
    nextOffset: items.length > pageSize ? offset + pageSize : null,
  };
}

// Recipes are public: browsing them needs no session. Favorites belong to the signed-in user.
export function recipeRoutes(db: Database, auth: Auth) {
  return new Hono<AuthenticatedEnv>()
    .get('/recipes', zValidator('query', recipeListQuerySchema), async (c) => {
      const { offset, author, part } = c.req.valid('query');
      // One author's recipes of every kind (⑰); otherwise a part's recipes (③) or whole-face ones (①).
      const where = author
        ? and(eq(recipe.authorId, author), part ? eq(recipe.part, part) : undefined)
        : part
          ? eq(recipe.part, part)
          : isNull(recipe.part);
      const items = await db
        .select(summaryFields)
        .from(recipe)
        .innerJoin(user, eq(recipe.authorId, user.id))
        .where(where)
        .orderBy(desc(recipe.createdAt), desc(recipe.id))
        .limit(pageSize + 1)
        .offset(offset);
      return c.json(page(items, offset));
    })
    // How many recipes each part has, for ②'s cards.
    .get('/recipe-parts', async (c) => {
      const items = await db
        .select({ part: recipe.part, count: count() })
        .from(recipe)
        .where(isNotNull(recipe.part))
        .groupBy(recipe.part);
      return c.json({ items });
    })
    .get(
      '/me/favorites',
      requireSession(auth),
      zValidator('query', feedQuerySchema.pick({ offset: true })),
      async (c) => {
        const { offset } = c.req.valid('query');
        const items = await db
          .select(summaryFields)
          .from(recipeFavorite)
          .innerJoin(recipe, eq(recipeFavorite.recipeId, recipe.id))
          .innerJoin(user, eq(recipe.authorId, user.id))
          .where(eq(recipeFavorite.userId, c.get('currentUser').id))
          .orderBy(desc(recipeFavorite.createdAt), desc(recipe.id))
          .limit(pageSize + 1)
          .offset(offset);
        return c.json(page(items, offset));
      },
    )
    .put(
      '/recipes/:id/favorite',
      requireSession(auth),
      zValidator('param', recipeParamsSchema),
      async (c) => {
        const { id } = c.req.valid('param');
        // INSERT ... SELECT avoids a foreign-key race with deletion, and the primary key makes
        // repeated taps and retries idempotent, like post likes.
        const added = await db
          .insert(recipeFavorite)
          .select(
            db
              .select({
                userId: sql<string>`${c.get('currentUser').id}`.as('user_id'),
                recipeId: recipe.id,
                createdAt: sql<Date>`now()`.as('created_at'),
              })
              .from(recipe)
              .where(eq(recipe.id, id)),
          )
          .onConflictDoNothing()
          .returning({ recipeId: recipeFavorite.recipeId });
        if (!added.length) {
          const [exists] = await db.select({ id: recipe.id }).from(recipe).where(eq(recipe.id, id));
          if (!exists) {
            return c.json({ error: 'not_found' as const }, 404);
          }
        }
        return c.json({ success: true });
      },
    )
    .delete(
      '/recipes/:id/favorite',
      requireSession(auth),
      zValidator('param', recipeParamsSchema),
      async (c) => {
        await db
          .delete(recipeFavorite)
          .where(
            and(
              eq(recipeFavorite.recipeId, c.req.valid('param').id),
              eq(recipeFavorite.userId, c.get('currentUser').id),
            ),
          );
        return c.json({ success: true });
      },
    )
    .get('/recipes/:id', zValidator('param', recipeParamsSchema), async (c) => {
      const { id } = c.req.valid('param');
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const [found] = await db
        .select({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          tags: recipe.tags,
          durationMinutes: recipe.durationMinutes,
          likeCount: recipe.likeCount,
          source: recipe.source,
          part: recipe.part,
          summary: recipe.summary,
          author: { id: user.id, name: user.name, image: user.image },
          favorited: session
            ? sql<boolean>`exists(select 1 from ${recipeFavorite} where ${recipeFavorite.recipeId} = ${recipe.id} and ${recipeFavorite.userId} = ${session.user.id})`
            : sql<boolean>`false`,
        })
        .from(recipe)
        .innerJoin(user, eq(recipe.authorId, user.id))
        .where(eq(recipe.id, id));
      if (!found) {
        return c.json({ error: 'not_found' as const }, 404);
      }
      const products = await db
        .select({
          id: product.id,
          name: product.name,
          image: product.image,
          purchasable: product.purchasable,
          usage: recipeProduct.usage,
        })
        .from(recipeProduct)
        .innerJoin(product, eq(recipeProduct.productId, product.id))
        .where(eq(recipeProduct.recipeId, id))
        .orderBy(asc(recipeProduct.position));
      const steps = await db
        .select({
          part: recipeStep.part,
          label: recipeStep.label,
          title: recipeStep.title,
          hint: recipeStep.hint,
          product: recipeStep.product,
          colors: recipeStep.colors,
        })
        .from(recipeStep)
        .where(eq(recipeStep.recipeId, id))
        .orderBy(asc(recipeStep.position));
      return c.json({ recipe: { ...found, products, steps } });
    });
}
