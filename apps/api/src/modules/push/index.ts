import { zValidator } from '@hono/zod-validator';
import { pushDataSchema } from '@starter/shared';
import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../../db/client';
import type { Auth, AuthenticatedEnv } from '../auth';

import { pushSubscription, recipe, session } from '../../db/schema';
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
type RecipeLiked = Extract<PushData, { kind: 'recipe-liked' }> & {
  actorName: string;
  recipeTitle: string;
  recipeImage: string;
};
type RecipeProgress = Exclude<PushData, { kind: 'recipe-liked' }> & { recipeTitle?: string };
type PushEvent = RecipeLiked | RecipeProgress;

const recipeMessages = {
  'recipe-started': {
    title: (name: string) => `🎬 ${name}を作成しています`,
    body: 'SNS動画からメイクの手順をまとめています。',
  },
  'recipe-ready': {
    title: (name: string) => `✨ ${name}ができました`,
    body: '動画から作ったメイクの手順を確認できます。',
  },
  'recipe-failed': {
    title: (name: string) => `⚠️ ${name}を作成できませんでした`,
    body: 'アプリで確認して、もう一度お試しください。',
  },
} satisfies Record<RecipeProgress['kind'], { title: (name: string) => string; body: string }>;

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const imageUrlSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

function excerpt(text: string, limit: number) {
  const characters = Array.from(
    segmenter.segment(text.replace(/\s+/gu, ' ').trim()),
    (part) => part.segment,
  );
  return characters.length > limit
    ? `${characters.slice(0, limit).join('')}…`
    : characters.join('');
}

async function notificationContent(db: Database, event: PushEvent) {
  if (event.kind === 'recipe-liked') {
    const actor = excerpt(event.actorName, 24);
    return {
      title: actor ? `❤️ ${actor}さんがいいねしました` : '❤️ レシピにいいねが届きました',
      body: `レシピ「${excerpt(event.recipeTitle, 48)}」`,
      channelId: 'likes',
      image: event.recipeImage,
    } as const;
  }
  const [published] =
    event.kind === 'recipe-ready' && event.recipeId
      ? await db
          .select({ title: recipe.title, image: recipe.image })
          .from(recipe)
          .where(and(eq(recipe.id, event.recipeId), eq(recipe.authorId, event.recipientId)))
      : [];
  const name = excerpt(published?.title ?? event.recipeTitle ?? '', 32);
  const template = recipeMessages[event.kind];
  return {
    title: template.title(name ? `「${name}」` : 'レシピ'),
    body: template.body,
    channelId: 'recipe-import',
    image: published?.image ?? null,
  } as const;
}

const pushTickets = z.object({
  data: z.array(
    z.object({
      status: z.enum(['ok', 'error']),
      details: z.object({ error: z.string() }).optional(),
    }),
  ),
});

/** Send a committed domain event. A delivery failure must never roll back the source action. */
export function createPushSender(db: Database, accessToken: string | undefined, apiOrigin: string) {
  return async (event: PushEvent) => {
    if (!accessToken) {
      return;
    }
    try {
      const data = pushDataSchema.parse(event);
      const recipients = await db
        .select({ token: pushSubscription.token, sessionId: pushSubscription.sessionId })
        .from(session)
        .innerJoin(pushSubscription, eq(pushSubscription.sessionId, session.id))
        .where(and(eq(session.userId, data.recipientId), gt(session.expiresAt, new Date())));
      if (!recipients.length) {
        return;
      }
      const { image, ...content } = await notificationContent(db, event);
      const url = image ? URL.parse(image, apiOrigin) : null;
      const thumbnail = url && !url.username && !url.password && imageUrlSchema.safeParse(url.href);
      const message = {
        ...content,
        data,
        ttl: 3600,
        ...(thumbnail && thumbnail.success
          ? { richContent: { image: thumbnail.data }, mutableContent: true }
          : {}),
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
      console.warn('Push notification delivery failed', event.kind);
    }
  };
}
