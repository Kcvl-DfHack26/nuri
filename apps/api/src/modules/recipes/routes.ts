import { zValidator } from '@hono/zod-validator';
import { recipeListQuerySchema, recipeParamsSchema } from '@starter/shared';
import { asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';

import { product, recipe, recipeProduct, recipeStep, user } from '../../db/schema';

const pageSize = 20;

// Recipes are public: browsing them needs no session.
export function recipeRoutes(db: Database) {
  return new Hono()
    .get('/recipes', zValidator('query', recipeListQuerySchema), async (c) => {
      const { offset } = c.req.valid('query');
      const items = await db
        .select({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          likeCount: recipe.likeCount,
          author: { id: user.id, name: user.name },
        })
        .from(recipe)
        .innerJoin(user, eq(recipe.authorId, user.id))
        .orderBy(desc(recipe.createdAt), desc(recipe.id))
        .limit(pageSize + 1)
        .offset(offset);
      return c.json({
        items: items.slice(0, pageSize),
        nextOffset: items.length > pageSize ? offset + pageSize : null,
      });
    })
    .get('/recipes/:id', zValidator('param', recipeParamsSchema), async (c) => {
      const { id } = c.req.valid('param');
      const [found] = await db
        .select({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          tags: recipe.tags,
          durationMinutes: recipe.durationMinutes,
          likeCount: recipe.likeCount,
          source: recipe.source,
          author: { id: user.id, name: user.name, image: user.image },
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
