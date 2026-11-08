import type { Column } from 'drizzle-orm';

import { count, eq, sql } from 'drizzle-orm';

import type { Database } from './client';

import { recipeFavorite } from './schema';

/**
 * The heart's count of a recipe: a sample's carried-over popularity plus its favorites in nuri
 * (#191). Profiles add these up for the user's いいね (#195).
 */
export function likeCountOf(db: Database, recipeId: Column, carriedOver: Column) {
  return sql<number>`${carriedOver} + (${db
    .select({ count: count() })
    .from(recipeFavorite)
    .where(eq(recipeFavorite.recipeId, recipeId))})`.mapWith(Number);
}
