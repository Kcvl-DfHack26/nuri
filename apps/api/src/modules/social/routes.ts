import { zValidator } from '@hono/zod-validator';
import { profilePatchSchema, userParamsSchema } from '@starter/shared';
import { and, eq, exists, sql, sum } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { likeCountOf } from '../../db/like-count';
import { follow, recipe, user } from '../../db/schema';
import { requireSession } from '../auth';

export function socialRoutes(db: Database, auth: Auth) {
  return (
    new Hono<AuthenticatedEnv>()
      .get('/users/:id', zValidator('param', userParamsSchema), async (c) => {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        const [profile] = await db
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
            handle: user.handle,
            bio: user.bio,
            isPublic: user.isPublic,
            followerCount: db.$count(follow, eq(follow.followeeId, user.id)),
            followingCount: db.$count(follow, eq(follow.followerId, user.id)),
            // The hearts on all of the user's recipes, counted the same way as each recipe's.
            likeCount: sql<number>`coalesce((${db
              .select({ total: sum(likeCountOf(db, recipe.id, recipe.likeCount)) })
              .from(recipe)
              .where(eq(recipe.authorId, user.id))}), 0)`.mapWith(Number),
            following: exists(
              db
                .select({ followeeId: follow.followeeId })
                .from(follow)
                .where(
                  and(
                    eq(follow.followeeId, user.id),
                    eq(follow.followerId, sql.param(session?.user.id ?? null)),
                  ),
                ),
            ).mapWith(Boolean),
          })
          .from(user)
          .where(
            and(
              eq(user.id, c.req.valid('param').id),
              session?.user.id === c.req.valid('param').id ? undefined : eq(user.isPublic, true),
            ),
          );
        if (!profile) {
          return c.json({ error: 'not_found' as const }, 404);
        }
        return c.json({ user: profile });
      })
      .get('/me/profile', requireSession(auth), async (c) => {
        const [profile] = await db
          .select({
            name: user.name,
            handle: user.handle,
            bio: user.bio,
            isPublic: user.isPublic,
            faceType: user.faceType,
          })
          .from(user)
          .where(eq(user.id, c.get('currentUser').id));
        if (!profile) {
          return c.json({ error: 'not_found' as const }, 404);
        }
        return c.json({ profile });
      })
      .patch(
        '/me/profile',
        requireSession(auth),
        zValidator('json', profilePatchSchema),
        async (c) => {
          try {
            await db
              .update(user)
              .set({ ...c.req.valid('json'), updatedAt: new Date() })
              .where(eq(user.id, c.get('currentUser').id));
            return c.json({ success: true });
          } catch (error) {
            const cause = error instanceof Error && 'cause' in error ? error.cause : error;
            if (cause instanceof Error && 'code' in cause && cause.code === '23505') {
              return c.json({ error: 'handle_taken' as const }, 409);
            }
            throw error;
          }
        },
      )
      .get('/me', requireSession(auth), (c) => {
        const current = c.get('currentUser');
        return c.json({ user: { id: current.id, name: current.name, email: current.email } });
      })
      // Following is idempotent like favorites. Only public profiles can be followed, and nobody
      // follows themselves (the table refuses it too).
      .put(
        '/users/:id/follow',
        requireSession(auth),
        zValidator('param', userParamsSchema),
        async (c) => {
          const followerId = c.get('currentUser').id;
          const { id } = c.req.valid('param');
          if (id === followerId) {
            return c.json({ error: 'self_follow' as const }, 400);
          }
          const followee = and(eq(user.id, id), eq(user.isPublic, true));
          // INSERT ... SELECT avoids a foreign-key race with the followee's deletion.
          const added = await db
            .insert(follow)
            .select(
              db
                .select({
                  followerId: sql
                    .param(followerId, follow.followerId)
                    .getSQL()
                    .as(follow.followerId.name),
                  followeeId: user.id,
                })
                .from(user)
                .where(followee),
            )
            .onConflictDoNothing()
            .returning({ followeeId: follow.followeeId });
          if (!added.length) {
            const [found] = await db.select({ id: user.id }).from(user).where(followee);
            if (!found) {
              return c.json({ error: 'not_found' as const }, 404);
            }
          }
          return c.json({ success: true });
        },
      )
      .delete(
        '/users/:id/follow',
        requireSession(auth),
        zValidator('param', userParamsSchema),
        async (c) => {
          await db
            .delete(follow)
            .where(
              and(
                eq(follow.followerId, c.get('currentUser').id),
                eq(follow.followeeId, c.req.valid('param').id),
              ),
            );
          return c.json({ success: true });
        },
      )
  );
}
