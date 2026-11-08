import { zValidator } from '@hono/zod-validator';
import {
  feedQuerySchema,
  postInputSchema,
  postParamsSchema,
  profilePatchSchema,
  userParamsSchema,
} from '@starter/shared';
import { and, desc, eq, exists, sql, sum } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { likeCountOf } from '../../db/like-count';
import { follow, like, post, recipe, user } from '../../db/schema';
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
      .get('/posts', zValidator('query', feedQuerySchema), async (c) => {
        const { offset, author } = c.req.valid('query');
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        const items = await db
          .select({
            id: post.id,
            body: post.body,
            createdAt: post.createdAt,
            author: { id: user.id, name: user.name, image: user.image },
            likeCount: db.$count(like, eq(like.postId, post.id)),
            liked: exists(
              db
                .select({ postId: like.postId })
                .from(like)
                .where(
                  and(
                    eq(like.postId, post.id),
                    eq(like.userId, sql.param(session?.user.id ?? null)),
                  ),
                ),
            ).mapWith(Boolean),
          })
          .from(post)
          .innerJoin(user, eq(post.userId, user.id))
          .where(author ? eq(post.userId, author) : undefined)
          .orderBy(desc(post.createdAt), desc(post.id))
          .limit(21)
          .offset(offset);
        return c.json({
          items: items.slice(0, 20),
          nextOffset: items.length > 20 ? offset + 20 : null,
        });
      })
      .get('/me', requireSession(auth), (c) => {
        const current = c.get('currentUser');
        return c.json({ user: { id: current.id, name: current.name, email: current.email } });
      })
      .post('/posts', requireSession(auth), zValidator('json', postInputSchema), async (c) => {
        const id = crypto.randomUUID();
        await db
          .insert(post)
          .values({ id, userId: c.get('currentUser').id, body: c.req.valid('json').body });
        return c.json({ id }, 201);
      })
      .delete(
        '/posts/:id',
        requireSession(auth),
        zValidator('param', postParamsSchema),
        async (c) => {
          const deleted = await db
            .delete(post)
            .where(
              and(eq(post.id, c.req.valid('param').id), eq(post.userId, c.get('currentUser').id)),
            )
            .returning({ id: post.id });
          if (!deleted.length) {
            return c.json({ error: 'not_found' as const }, 404);
          }
          return c.json({ success: true });
        },
      )
      .put(
        '/posts/:id/like',
        requireSession(auth),
        zValidator('param', postParamsSchema),
        async (c) => {
          const existing = await db
            .select({ id: post.id })
            .from(post)
            .where(eq(post.id, c.req.valid('param').id));
          if (!existing.length) {
            return c.json({ error: 'not_found' as const }, 404);
          }
          // INSERT ... SELECT avoids a foreign-key race with deletion. The unique
          // key makes repeated taps and network retries idempotent.
          await db
            .insert(like)
            .select(
              db
                .select({
                  postId: post.id,
                  userId: sql
                    .param(c.get('currentUser').id, like.userId)
                    .getSQL()
                    .as(like.userId.name),
                })
                .from(post)
                .where(eq(post.id, c.req.valid('param').id)),
            )
            .onConflictDoNothing();
          return c.json({ success: true });
        },
      )
      .delete(
        '/posts/:id/like',
        requireSession(auth),
        zValidator('param', postParamsSchema),
        async (c) => {
          await db
            .delete(like)
            .where(
              and(
                eq(like.postId, c.req.valid('param').id),
                eq(like.userId, c.get('currentUser').id),
              ),
            );
          return c.json({ success: true });
        },
      )
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
