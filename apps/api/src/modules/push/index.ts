import { zValidator } from '@hono/zod-validator';
import { type pushChannels, type pushDataSchema } from '@starter/shared';
import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { pushSubscription, session } from '../../db/schema';
import { requireSession } from '../auth';

const tokenSchema = z
  .string()
  .max(128)
  .regex(/^(?:Expo|Exponent)PushToken\[[\w-]+\]$/);

export function pushRoutes(db: Database, auth: Auth, accessToken: string | undefined) {
  return new Hono<AuthenticatedEnv>().put(
    '/me/push-subscription',
    requireSession(auth),
    zValidator('json', z.object({ token: tokenSchema, sessionId: z.string().min(1).max(128) })),
    async (c) => {
      if (!accessToken) {
        return c.json({ error: 'push_unavailable' as const }, 503);
      }
      const { token, sessionId } = c.req.valid('json');
      if (sessionId !== c.get('sessionId')) {
        return c.json({ error: 'session_changed' as const }, 409);
      }
      // A reinstalled app can get the same token. Only the latest session may use it.
      await db
        .insert(pushSubscription)
        .values({ token, sessionId })
        .onConflictDoUpdate({ target: pushSubscription.token, set: { sessionId } });
      return c.json({ success: true });
    },
  );
}

type PushData = z.infer<typeof pushDataSchema>;
type PushEvent = PushData & { imageUrl?: string };

const messages = {
  'post-liked': {
    title: '❤️ 投稿にいいねが届きました',
    body: '自分の投稿を確認できます。',
    channelId: 'likes',
  },
  'recipe-started': {
    title: '🎬 レシピを作成しています',
    body: 'SNS動画からメイクの手順をまとめています。',
    channelId: 'recipe-import',
  },
  'recipe-ready': {
    title: '✨ レシピができました',
    body: '動画から作ったメイクの手順を確認できます。',
    channelId: 'recipe-import',
  },
  'recipe-failed': {
    title: '⚠️ レシピを作成できませんでした',
    body: 'アプリで確認して、もう一度お試しください。',
    channelId: 'recipe-import',
  },
} satisfies Record<
  PushData['kind'],
  { title: string; body: string; channelId: keyof typeof pushChannels }
>;

const imageUrlSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

const pushTickets = z.object({
  data: z.array(
    z.object({
      status: z.enum(['ok', 'error']),
      details: z.object({ error: z.string() }).optional(),
    }),
  ),
});

/** Send a committed domain event. A delivery failure must never roll back the source action. */
export function createPushSender(db: Database, accessToken: string | undefined) {
  return async ({ imageUrl, ...data }: PushEvent) => {
    if (!accessToken) {
      return;
    }
    try {
      const recipients = await db
        .select({ token: pushSubscription.token, sessionId: pushSubscription.sessionId })
        .from(session)
        .innerJoin(pushSubscription, eq(pushSubscription.sessionId, session.id))
        .where(and(eq(session.userId, data.recipientId), gt(session.expiresAt, new Date())));
      const image = data.kind === 'recipe-ready' && imageUrlSchema.safeParse(imageUrl);
      const message = {
        ...messages[data.kind],
        data,
        ttl: 3600,
        ...(image && image.success ? { richContent: { image: image.data } } : {}),
      };
      const signal = AbortSignal.timeout(2000);
      for (let index = 0; index < recipients.length; index += 100) {
        const batch = recipients.slice(index, index + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch.map(({ token }) => ({ ...message, to: token }))),
          signal,
        });
        if (!response.ok) {
          throw new Error('Expo push request failed');
        }
        const { data: tickets } = pushTickets.parse(await response.json());
        await Promise.all(
          batch.map(async ({ token, sessionId }, position) => {
            if (tickets[position]?.details?.error === 'DeviceNotRegistered') {
              await db
                .delete(pushSubscription)
                .where(
                  and(eq(pushSubscription.token, token), eq(pushSubscription.sessionId, sessionId)),
                );
              return;
            }
            if (tickets[position]?.status !== 'ok') {
              console.warn('Expo rejected a push notification', data.kind);
            }
          }),
        );
      }
    } catch {
      // Provider errors can contain recipient tokens.
      console.warn('Push notification delivery failed', data.kind);
    }
  };
}
