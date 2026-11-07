import { zValidator } from '@hono/zod-validator';
import {
  feedQuerySchema,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
} from '@starter/shared';
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import {
  product,
  recipe,
  recipeFavorite,
  recipeImage,
  recipeProduct,
  recipeStep,
  user,
} from '../../db/schema';
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
  return (
    new Hono<AuthenticatedEnv>()
      .get('/recipes', zValidator('query', recipeListQuerySchema), async (c) => {
        const { offset, author, part, q } = c.req.valid('query');
        // A search term matches part of the title or of one tag, case-insensitively. Escape LIKE's
        // wildcards (and its escape character) so they match literally.
        const pattern = q && `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        // One author's recipes (⑰) and search results are of every kind; otherwise a part's
        // recipes (③) or whole-face ones (①).
        const where = and(
          author ? eq(recipe.authorId, author) : undefined,
          part ? eq(recipe.part, part) : author || pattern ? undefined : isNull(recipe.part),
          pattern
            ? or(
                ilike(recipe.title, pattern),
                sql`exists (select 1 from unnest(${recipe.tags}) as tag where tag ilike ${pattern})`,
              )
            : undefined,
        );
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
      // A whole-face recipe posted from ③. Only the texts, the steps and one JPEG frame arrive;
      // the video never leaves the device.
      .post('/recipes', requireSession(auth), zValidator('json', recipeInputSchema), async (c) => {
        const input = c.req.valid('json');
        // The schema already bounds the base64 length to the decoded size limit.
        const bytes = Buffer.from(input.thumbnail, 'base64');
        const id = `p-${crypto.randomUUID()}`;
        await db.transaction(async (tx) => {
          await tx.insert(recipe).values({
            id,
            authorId: c.get('currentUser').id,
            title: input.title,
            image: `/api/recipe-images/${id}`,
            tags: input.tags,
            durationMinutes: input.durationMinutes,
            summary: input.summary || null,
          });
          await tx.insert(recipeStep).values(
            input.steps.map((step, position) => ({
              recipeId: id,
              position,
              part: step.part,
              label: step.label,
              title: step.title,
              hint: step.description,
              product: step.uses,
              colors: [step.color],
            })),
          );
          await tx.insert(recipeImage).values({ recipeId: id, contentType: 'image/jpeg', bytes });
        });
        return c.json({ id }, 201);
      })
      // Recipes are public, and so are the thumbnails of posted ones. A posted image never
      // changes, so clients may keep it.
      .get('/recipe-images/:id', zValidator('param', recipeParamsSchema), async (c) => {
        const [image] = await db
          .select({ contentType: recipeImage.contentType, bytes: recipeImage.bytes })
          .from(recipeImage)
          .where(eq(recipeImage.recipeId, c.req.valid('param').id));
        if (!image) {
          return c.json({ error: 'not_found' as const }, 404);
        }
        c.header('Content-Type', image.contentType);
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
        c.header('X-Content-Type-Options', 'nosniff');
        return c.body(new Uint8Array(image.bytes));
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
            const [exists] = await db
              .select({ id: recipe.id })
              .from(recipe)
              .where(eq(recipe.id, id));
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
            purchaseUrl: product.purchaseUrl,
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
      })
  );
}
