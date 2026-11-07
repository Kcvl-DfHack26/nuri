import { makeupParts, recipeSources } from '@starter/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  bytea,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  handle: text('handle').unique(),
  bio: text('bio').default('').notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const passkey = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull().unique(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at'),
    aaguid: text('aaguid'),
  },
  (table) => [index('passkey_user_id_idx').on(table.userId)],
);

export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const post = pgTable(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('post_created_at_idx').on(table.createdAt),
    index('post_user_id_idx').on(table.userId),
  ],
);

export const like = pgTable(
  'like',
  {
    postId: text('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const recipe = pgTable(
  'recipe',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Photo of the finished look; a path on this API or an absolute URL. */
    image: text('image').notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    durationMinutes: integer('duration_minutes').notNull(),
    // Display-only until saving recipes is built.
    likeCount: integer('like_count').notNull().default(0),
    source: text('source', { enum: recipeSources }),
    /** The one part a part recipe (②③) works on; null for a whole-face recipe (①). */
    part: text('part', { enum: makeupParts }),
    /** A one-line description, e.g. ③'s caption under the style name. */
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('recipe_created_at_idx').on(table.createdAt),
    index('recipe_part_idx').on(table.part),
    index('recipe_author_id_idx').on(table.authorId),
  ],
);

export const product = pgTable('product', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  image: text('image'),
  // Superseded by purchaseUrl and no longer read. Drop it once no running API revision selects it.
  purchasable: boolean('purchasable').default(false).notNull(),
  /** Where ⑤'s 買う opens the product, always https; null when there is nowhere to buy it. */
  purchaseUrl: text('purchase_url'),
});

/**
 * The JPEG thumbnail of a recipe posted from ③, served at `/api/recipe-images/:id`. Kept in the
 * database so posting needs no storage bucket.
 */
export const recipeImage = pgTable('recipe_image', {
  recipeId: text('recipe_id')
    .primaryKey()
    .references(() => recipe.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  bytes: bytea('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** The cosmetics a recipe uses, in the order ⑤ lists them. */
export const recipeProduct = pgTable(
  'recipe_product',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    /** How this recipe uses the product, e.g. 眉・モカブラウン. */
    usage: text('usage').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.productId] }),
    index('recipe_product_product_id_idx').on(table.productId),
  ],
);

/** The steps ⑦ walks through, in order. */
export const recipeStep = pgTable(
  'recipe_step',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    part: text('part', { enum: makeupParts }).notNull(),
    /** Short name in the step list, e.g. シャドウ. */
    label: text('label').notNull(),
    title: text('title').notNull(),
    hint: text('hint').notNull(),
    /** The kind of cosmetic the step uses, e.g. アイライン. */
    product: text('product').notNull(),
    /** Recommended colors as #RRGGBB, shown as swatches. */
    colors: text('colors').array().notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

/** Recipes a user keeps as favorites (⑤ and ⑰). */
export const recipeFavorite = pgTable(
  'recipe_favorite',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index('recipe_favorite_recipe_id_idx').on(table.recipeId),
  ],
);
