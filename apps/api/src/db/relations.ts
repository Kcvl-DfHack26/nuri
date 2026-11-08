import { defineRelations } from 'drizzle-orm';

import { product, recipe, recipeProduct, recipeStep, user } from './schema';

export const relations = defineRelations(
  { product, recipe, recipeProduct, recipeStep, user },
  (r) => ({
    recipe: {
      author: r.one.user({ from: r.recipe.authorId, to: r.user.id, optional: false }),
      products: r.many.recipeProduct({ from: r.recipe.id, to: r.recipeProduct.recipeId }),
      steps: r.many.recipeStep({ from: r.recipe.id, to: r.recipeStep.recipeId }),
    },
    recipeProduct: {
      product: r.one.product({
        from: r.recipeProduct.productId,
        to: r.product.id,
        optional: false,
      }),
    },
  }),
);
