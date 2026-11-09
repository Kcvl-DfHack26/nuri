import type { MakeupShape } from '@starter/shared';

import { faceTypeIds, makeupParts, recipeSources } from '@starter/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  bytea,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const authTimestamps = () => ({
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const createdAtWithTimezone = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  handle: text('handle').unique(),
  bio: text('bio').default('').notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  /** The face type chosen on ⑰-2 or saved from ⑭ (#194); only its owner reads it. */
  faceType: text('face_type', { enum: faceTypeIds }),
  ...authTimestamps(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ...authTimestamps(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const pushSubscription = pgTable(
  'push_subscription',
  {
    token: text('token').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
  },
  (table) => [index('push_subscription_session_id_idx').on(table.sessionId)],
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
    ...authTimestamps(),
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
    ...authTimestamps(),
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

/** Who follows whom (#195). A user cannot follow themselves. */
export const follow = pgTable(
  'follow',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAtWithTimezone(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index('follow_followee_id_idx').on(table.followeeId),
    check('follow_not_self', sql`${table.followerId} <> ${table.followeeId}`),
  ],
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
    /** A sample's carried-over popularity; the heart shows it plus the recipe's favorites (#191). */
    likeCount: integer('like_count').notNull().default(0),
    source: text('source', { enum: recipeSources }),
    /** The one part a part recipe (②③) works on; null for a whole-face recipe (①). */
    part: text('part', { enum: makeupParts }),
    /** A one-line description, e.g. ③'s caption under the style name. */
    summary: text('summary'),
    createdAt: createdAtWithTimezone(),
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
  createdAt: createdAtWithTimezone(),
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
    /** Where ⑦ paints (`makeupShapeSchema`); null paints the part's standard texture. */
    shape: jsonb('shape').$type<MakeupShape>(),
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
    createdAt: createdAtWithTimezone(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index('recipe_favorite_recipe_id_idx').on(table.recipeId),
  ],
);
