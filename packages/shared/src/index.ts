import { z } from 'zod';

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
/** A shop page for a cosmetic. Only https, so ⑤ never opens another scheme or plain http. */
export const purchaseUrlSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain });
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
/**
 * Where a makeup step paints, drawn on device into MediaPipe's canonical face texture (UV, 0–1 across
 * the texture, y downward). Each point is a face landmark's UV moved by dx, dy, so the area follows
 * every face the landmarks fit. Strokes are drawn in order: smooth lines or filled outlines with a
 * soft edge, or `erase` to cut an area out of what is drawn, such as the open mouth. With `mirror`, a
 * stroke is also drawn on the other half of the face (the canonical UV is symmetric at u = 0.5). A
 * step without a shape uses its part's standard texture.
 */
export const makeupShapeSchema = z.object({
  strokes: z
    .array(
      z
        .object({
          points: z
            .array(
              z.object({
                // The canonical mesh covers MediaPipe's first 468 landmarks; the irises are not in it.
                at: z.int().min(0).max(467),
                dx: z.number().min(-0.2).max(0.2).optional(),
                dy: z.number().min(-0.2).max(0.2).optional(),
              }),
            )
            .min(1)
            .max(40),
          /** Filled outline instead of a line through the points. */
          fill: z.boolean().optional(),
          /** Cut the stroke out of what is drawn before it instead of painting it. */
          erase: z.boolean().optional(),
          mirror: z.boolean().optional(),
          /** Line width in UV; ignored for a fill. */
          width: z.number().min(0).max(0.3).optional(),
          /** Soft edge in UV. */
          blur: z.number().min(0).max(0.1).optional(),
          opacity: z.number().min(0).max(1).optional(),
        })
        // A fill needs an area.
        .refine((stroke) => !stroke.fill || stroke.points.length >= 3, 'A fill needs 3 points'),
    )
    .min(1)
    .max(8),
});
export type MakeupShape = z.infer<typeof makeupShapeSchema>;
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

/** IDs of recipes posted from ⑫ start with this; the seeded ones never do. */
export const postedRecipeIdPrefix = 'p-';
/** Most steps a posted recipe may have; ⑫-2 stops adding marks at this. */
export const recipeStepsMax = 20;
/** Most tags a posted recipe may have; ⑫-7 stops adding tags at this. */
export const recipeTagsMax = 10;
/** Largest thumbnail a posted recipe may carry, in decoded bytes. */
export const recipeThumbnailMaxBytes = 1_500_000;
/** Base64 of a JPEG starts with its FF D8 FF marker, which encodes to `/9j/`. */
const jpegBase64Prefix = '/9j/';
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/** One step of a recipe posted from ③ (⑫): the part, its texts, the cosmetics used and a color. */
export const recipeStepInputSchema = z.object({
  part: z.enum(makeupParts),
  label: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200),
  uses: z.string().trim().min(1).max(200),
  color: hexColor,
  /** The painted area read from the video (#156); none uses no texture in ⑦⑩. */
  shape: makeupShapeSchema.optional(),
});

/**
 * A recipe posted from ③. The video stays on the device; only the texts, the steps and one JPEG
 * frame as base64 are sent.
 */
export const recipeInputSchema = z.object({
  /** Made once per draft, so a post resent after a lost response is saved only once. */
  key: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, 'タイトルを入力してください')
    .max(40, 'タイトルは40文字以内で入力してください'),
  summary: z.string().trim().max(200, 'メッセージは200文字以内で入力してください'),
  tags: z.array(z.string().trim().min(1).max(30)).max(recipeTagsMax),
  durationMinutes: z.number().int().min(1).max(600),
  steps: z.array(recipeStepInputSchema).min(1).max(recipeStepsMax),
  thumbnail: z
    .base64()
    .max(Math.ceil(recipeThumbnailMaxBytes / 3) * 4)
    .refine((value) => value.startsWith(jpegBase64Prefix), 'サムネイルはJPEGにしてください'),
});

/** Largest video ⑫-3 may send for analysis; Cloud Run accepts request bodies up to 32 MiB. */
export const postAnalysisVideoMaxBytes = 30_000_000;

/**
 * Face landmarks a painted area can start or end at. The app turns each into MediaPipe landmark
 * numbers, so Gemini only picks names and never numbers (#46).
 */
const postRegionAnchors = [
  'browHead',
  'browPeak',
  'browTail',
  'browTailLine',
  'eyeInner',
  'eyeOuter',
  'irisCenter',
  'irisOuter',
  'upperLidEdge',
  'lowerLidEdge',
  'noseWing',
  'mouthCorner',
  'cheekboneTop',
  'cheekCenter',
  'temple',
  'jawAngle',
  'glabella',
  'noseRoot',
  'noseBridge',
  'noseTip',
  'upperLipCenter',
  'lowerLipCenter',
  'chin',
  'foreheadCenter',
  'brow',
  'upperLip',
  'lowerLip',
  'lips',
] as const;
const postRegionAreas = ['brow', 'upperLip', 'lowerLip', 'lips'] as const;

/**
 * One painted area of a step, chosen from fixed words. The width comes from the face, not from
 * Gemini, because its millimetre guesses drew areas too thick (#46).
 */
const postRegionSchema = z.object({
  /** A longer description for people, in the words of the team's makeup notes. */
  detail: z.string().trim().max(300),
  /** Left or right as seen on the video, which may be mirrored; the app maps it to the face. */
  side: z.enum(['screenLeft', 'screenRight', 'both', 'center']),
  start: z.enum(postRegionAnchors),
  end: z.enum([...postRegionAnchors, 'none']),
  shape: z.enum(['dot', 'line', 'band', 'ellipse', 'arc', 'area']),
  /** How far the area reaches past `start` when there is no `end`. */
  length: z.enum(['none', 'short', 'medium', 'long']),
  direction: z.enum(['none', 'outward', 'inward', 'upOutward', 'downOutward', 'up', 'down']),
  /** Keep the area inside this part, e.g. only the middle of the upper lip. */
  clip: z.enum([...postRegionAreas, 'none']),
});

/** What the API answers for a video posted from ⑫-3: the draft of the steps and the cosmetics. */
export const postAnalysisSchema = z.object({
  title: z.string().trim().max(40),
  summary: z.string().trim().max(200),
  steps: z
    .array(
      z.object({
        /** Seconds from the start of the video. */
        start: z.number().min(0),
        end: z.number().min(0),
        part: z.enum(makeupParts),
        description: z.string().trim().max(200),
        regions: z.array(postRegionSchema).max(8),
        /** Indexes into `cosmetics`. */
        cosmetics: z.array(z.int().min(0)).max(10),
      }),
    )
    .max(recipeStepsMax),
  cosmetics: z
    .array(
      z.object({
        brand: z.string().trim().max(60),
        name: z.string().trim().max(80),
        category: z.string().trim().max(40),
        confidence: z.enum(['high', 'medium', 'low']),
        /** Whether a Google search found the product; null when it could not be checked. */
        verified: z.boolean().nullable(),
        sources: z.array(z.object({ title: z.string().max(200), url: z.url() })).max(5),
      }),
    )
    .max(10),
});
export type PostAnalysis = z.infer<typeof postAnalysisSchema>;
