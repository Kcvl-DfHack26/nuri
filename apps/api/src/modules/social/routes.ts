import { zValidator } from '@hono/zod-validator';
import {
  feedQuerySchema,
  postInputSchema,
  postParamsSchema,
  profileInputSchema,
  userParamsSchema,
} from '@starter/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { like, post, user } from '../../db/schema';
import { requireSession } from '../auth';

export function socialRoutes(db: Database, auth: Auth) {
  return new Hono<AuthenticatedEnv>()
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
        .select({ name: user.name, handle: user.handle, bio: user.bio, isPublic: user.isPublic })
        .from(user)
        .where(eq(user.id, c.get('currentUser').id));
      if (!profile) {
        return c.json({ error: 'not_found' as const }, 404);
      }
      return c.json({ profile });
    })
    .put('/me/profile', requireSession(auth), zValidator('json', profileInputSchema), async (c) => {
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
    })
    .get('/posts', zValidator('query', feedQuerySchema), async (c) => {
      const { offset, author } = c.req.valid('query');
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const items = await db
        .select({
          id: post.id,
          body: post.body,
          createdAt: post.createdAt,
          author: { id: user.id, name: user.name, image: user.image },
          likeCount: sql<number>`(select count(*)::int from ${like} where ${like.postId} = ${post.id})`,
          liked: session
            ? sql<boolean>`exists(select 1 from ${like} where ${like.postId} = ${post.id} and ${like.userId} = ${session.user.id})`
            : sql<boolean>`false`,
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
                userId: sql<string>`${c.get('currentUser').id}`.as('user_id'),
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
            and(eq(like.postId, c.req.valid('param').id), eq(like.userId, c.get('currentUser').id)),
          );
        return c.json({ success: true });
      },
    );
}
