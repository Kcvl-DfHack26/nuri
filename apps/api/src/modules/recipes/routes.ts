import type { Column } from 'drizzle-orm';

import { zValidator } from '@hono/zod-validator';
import {
  feedQuerySchema,
  postedRecipeIdPrefix,
  productKindImage,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
} from '@starter/shared';
import {
  and,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';
import type { createPushSender } from '../push';

import { likeCountOf } from '../../db/like-count';
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

function page<T>(items: T[], offset: number) {
  return {
    items: items.slice(0, pageSize),
    nextOffset: items.length > pageSize ? offset + pageSize : null,
  };
}

// Recipes are public: browsing them needs no session. Favorites belong to the signed-in user.
export function recipeRoutes(
  db: Database,
  auth: Auth,
  sendPush: ReturnType<typeof createPushSender>,
) {
  /** Whether the viewer (none for a guest) has favorited the recipe with this ID. */
  const favoritedBy = (recipeId: Column, viewerId: string | null) =>
    exists(
      db
        .select({ recipeId: recipeFavorite.recipeId })
        .from(recipeFavorite)
        .where(
          and(
            eq(recipeFavorite.recipeId, recipeId),
            eq(recipeFavorite.userId, sql.param(viewerId)),
          ),
        ),
    ).mapWith(Boolean);
  const recipeSummaries = (viewerId: string | null, offset: number) =>
    db
      .select({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        tags: recipe.tags,
        summary: recipe.summary,
        likeCount: likeCountOf(db, recipe.id, recipe.likeCount),
        favorited: favoritedBy(recipe.id, viewerId),
        author: { id: user.id, name: user.name },
      })
      .from(recipe)
      .innerJoin(user, eq(recipe.authorId, user.id))
      .limit(pageSize + 1)
      .offset(offset);
  const viewerOf = async (headers: Headers) =>
    (await auth.api.getSession({ headers }))?.user.id ?? null;

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
        const items = await recipeSummaries(await viewerOf(c.req.raw.headers), offset)
          .where(where)
          .orderBy(desc(recipe.createdAt), desc(recipe.id));
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
        const id = `${postedRecipeIdPrefix}${input.key.toLowerCase()}`;
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
            // A resent post replaces its published cosmetics, which belong to this recipe only.
            const old = await tx
              .delete(recipeProduct)
              .where(eq(recipeProduct.recipeId, id))
              .returning({ productId: recipeProduct.productId });
            const own = old.map((row) => row.productId).filter((key) => key.startsWith(`${id}-`));
            if (own.length > 0) {
              await tx.delete(product).where(inArray(product.id, own));
            }
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
              shape: step.shape ?? null,
            })),
          );
          // ⑤ lists the cosmetics the user chose to publish (#224). They are the poster's own
          // words, so each is a product of this recipe only, shown with its kind's photo and no shop.
          const products = (input.products ?? []).map((item, position) => ({
            id: `${id}-${position}`,
            name: item.name,
            image: productKindImage(item.part),
            usage: item.usage,
            position,
          }));
          if (products.length > 0) {
            await tx
              .insert(product)
              .values(
                products.map(({ id: productId, name, image }) => ({ id: productId, name, image })),
              )
              // A product left by a deleted post with the same key is reused.
              .onConflictDoUpdate({
                target: product.id,
                set: { name: sql`excluded.name`, image: sql`excluded.image` },
              });
            await tx.insert(recipeProduct).values(
              products.map(({ id: productId, usage, position }) => ({
                recipeId: id,
                productId,
                position,
                usage,
              })),
            );
          }
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
          const viewerId = c.get('currentUser').id;
          const items = await recipeSummaries(viewerId, offset)
            .innerJoin(recipeFavorite, eq(recipeFavorite.recipeId, recipe.id))
            .where(eq(recipeFavorite.userId, viewerId))
            .orderBy(desc(recipeFavorite.createdAt), desc(recipe.id));
          return c.json(page(items, offset));
        },
      )
      .put(
        '/recipes/:id/favorite',
        requireSession(auth),
        zValidator('param', recipeParamsSchema),
        async (c) => {
          const { id } = c.req.valid('param');
          const actor = c.get('currentUser');
          // INSERT ... SELECT avoids a foreign-key race with deletion, and the primary key makes
          // repeated taps and retries idempotent.
          const added = await db
            .insert(recipeFavorite)
            .select(
              db
                .select({
                  userId: sql
                    .param(actor.id, recipeFavorite.userId)
                    .getSQL()
                    .as(recipeFavorite.userId.name),
                  recipeId: recipe.id,
                })
                .from(recipe)
                .where(eq(recipe.id, id)),
            )
            .onConflictDoNothing()
            .returning({ recipeId: recipeFavorite.recipeId });
          const [published] = await db
            .select({ authorId: recipe.authorId, title: recipe.title, image: recipe.image })
            .from(recipe)
            .where(eq(recipe.id, id));
          if (!added.length && !published) {
            return c.json({ error: 'not_found' as const }, 404);
          }
          if (added.length && published && published.authorId !== actor.id) {
            await sendPush({
              kind: 'recipe-liked',
              recipientId: published.authorId,
              recipeId: id,
              actorName: actor.name,
              recipeTitle: published.title,
              recipeImage: published.image,
            });
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
        const viewerId = await viewerOf(c.req.raw.headers);
        const found = await db.query.recipe.findFirst({
          where: { id },
          columns: {
            id: true,
            title: true,
            image: true,
            tags: true,
            durationMinutes: true,
            source: true,
            part: true,
            summary: true,
          },
          extras: {
            likeCount: (row) => likeCountOf(db, row.id, row.likeCount),
            favorited: (row) => favoritedBy(row.id, viewerId),
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
                shape: true,
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
