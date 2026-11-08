import { zValidator } from '@hono/zod-validator';
import {
  feedQuerySchema,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
} from '@starter/shared';
import { and, count, desc, eq, exists, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { recipe, recipeFavorite, recipeImage, recipeStep, user } from '../../db/schema';
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
        // The draft's key makes the ID, so a post resent after its response was lost is saved
        // once, with the contents of the latest send (the user may have changed the photo). The
        // same key from someone else is refused.
        const id = `p-${input.key.toLowerCase()}`;
        const authorId = c.get('currentUser').id;
        const fields = {
          title: input.title,
          image: `/api/recipe-images/${id}`,
          tags: input.tags,
          durationMinutes: input.durationMinutes,
          summary: input.summary || null,
        };
        const saved = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(recipe)
            .values({ id, authorId, ...fields })
            .onConflictDoNothing()
            .returning({ id: recipe.id });
          if (!inserted) {
            const [updated] = await tx
              .update(recipe)
              .set(fields)
              .where(and(eq(recipe.id, id), eq(recipe.authorId, authorId)))
              .returning({ id: recipe.id });
            if (!updated) {
              return false;
            }
            await tx.delete(recipeStep).where(eq(recipeStep.recipeId, id));
          }
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
          await tx
            .insert(recipeImage)
            .values({ recipeId: id, contentType: 'image/jpeg', bytes })
            .onConflictDoUpdate({ target: recipeImage.recipeId, set: { bytes } });
          return true;
        });
        if (!saved) {
          return c.json({ error: 'conflict' as const }, 409);
        }
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
                  userId: sql
                    .param(c.get('currentUser').id, recipeFavorite.userId)
                    .getSQL()
                    .as(recipeFavorite.userId.name),
                  recipeId: recipe.id,
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
        const found = await db.query.recipe.findFirst({
          where: { id },
          columns: {
            id: true,
            title: true,
            image: true,
            tags: true,
            durationMinutes: true,
            likeCount: true,
            source: true,
            part: true,
            summary: true,
          },
          extras: {
            favorited: (row) =>
              exists(
                db
                  .select({ recipeId: recipeFavorite.recipeId })
                  .from(recipeFavorite)
                  .where(
                    and(
                      eq(recipeFavorite.recipeId, row.id),
                      eq(recipeFavorite.userId, sql.param(session?.user.id ?? null)),
                    ),
                  ),
              ).mapWith(Boolean),
          },
          with: {
            author: { columns: { id: true, name: true, image: true } },
            products: {
              columns: { usage: true },
              orderBy: { position: 'asc' },
              with: {
                product: { columns: { id: true, name: true, image: true, purchaseUrl: true } },
              },
            },
            steps: {
              columns: {
                part: true,
                label: true,
                title: true,
                hint: true,
                product: true,
                colors: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        });
        if (!found) {
          return c.json({ error: 'not_found' as const }, 404);
        }
        const { products, ...detail } = found;
        return c.json({
          recipe: {
            ...detail,
            products: products.map(({ product, usage }) => ({ ...product, usage })),
          },
        });
      })
  );
}
