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

// Recipe IDs are readable slugs (e.g. fox) so seeded recipes keep stable URLs.
export const recipeParamsSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,64}$/) });
export const recipeListQuerySchema = feedQuerySchema.pick({ offset: true });
/** Where an imported recipe came from; null means it was made in nuri. */
export const recipeSources = ['instagram', 'tiktok', 'youtube'] as const;
