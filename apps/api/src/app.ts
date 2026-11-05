import { zValidator } from '@hono/zod-validator';
import { catalogQuerySchema, filterRituals } from '@starter/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import type { createAuth } from './auth';

type Auth = ReturnType<typeof createAuth>;

export function createApp(auth: Auth, ready: () => Promise<void>, origins: string[]) {
  return new Hono()
    .use('*', secureHeaders())
    .use(
      '/api/*',
      cors({ origin: origins.filter((origin) => origin.startsWith('http')), credentials: true }),
    )
    .get('/health', (c) => c.json({ status: 'ok' as const }))
    .get('/ready', async (c) => {
      try {
        await ready();
        return c.json({ status: 'ready' as const });
      } catch {
        return c.json({ status: 'unavailable' as const }, 503);
      }
    })
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .get('/api/rituals', zValidator('query', catalogQuerySchema), (c) =>
      c.json({ items: filterRituals(c.req.valid('query').q) }),
    )
    .get('/api/me', async (c) => {
      const current = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!current) {
        return c.json({ error: 'unauthorized' as const }, 401);
      }
      return c.json({
        user: { id: current.user.id, name: current.user.name, email: current.user.email },
      });
    })
    .onError((_error, c) => c.json({ error: 'internal_error' as const }, 500));
}
