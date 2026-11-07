import { z } from 'zod';

export const preferencesSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  haptics: z.boolean().default(true),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const postInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, '本文を入力してください')
    .max(500, '500文字以内で入力してください'),
});
export const postParamsSchema = z.object({ id: z.uuid() });
export const userParamsSchema = z.object({ id: z.string().min(1).max(128) });
export const feedQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  author: z.string().min(1).max(128).optional(),
});
export const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,20}$/, 'ユーザーIDは半角英小文字・数字・_で3〜20文字にしてください')
    .nullable(),
  bio: z.string().trim().max(42, '自己紹介は42文字以内で入力してください'),
  isPublic: z.boolean(),
});
export const profilePatchSchema = profileInputSchema
  .partial()
  .refine((fields) => Object.keys(fields).length > 0);

// Recipe IDs are readable slugs (e.g. fox) so seeded recipes keep stable URLs.
export const recipeParamsSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,64}$/) });
/** Where an imported recipe came from; null means it was made in nuri. */
export const recipeSources = ['instagram', 'tiktok', 'youtube'] as const;
/** The face parts a makeup step works on, in Plan A's ② order. */
export const makeupParts = [
  'base',
  'brow',
  'eye',
  'lash',
  'cheek',
  'shading',
  'highlight',
  'lip',
] as const;
/** Longest recipe search term, shared by the API and the search field. */
export const recipeSearchMaxLength = 50;
/**
 * Whole-face recipes by default; with `part`, the recipes for that one part (② ③); with `author`,
 * one user's recipes, e.g. on their ⑰ page; with `q`, the recipes of every kind whose title or a
 * tag contains it.
 */
export const recipeListQuerySchema = feedQuerySchema.pick({ offset: true, author: true }).extend({
  part: z.enum(makeupParts).optional(),
  q: z.string().trim().min(1).max(recipeSearchMaxLength).optional(),
});
