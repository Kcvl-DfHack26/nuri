import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Auth } from './service';

export function authRoutes(auth: Auth, baseURL: string) {
  return new Hono()
    .post(
      '/mobile-magic-link',
      zValidator('json', z.object({ token: z.string().min(1).max(256) })),
      async (c) => {
        const url = new URL('/api/auth/magic-link/verify', baseURL);
        url.searchParams.set('token', c.req.valid('json').token);
        url.searchParams.set('callbackURL', baseURL);
        const response = await auth.handler(new Request(url, { headers: c.req.raw.headers }));
        if (
          response.status !== 302 ||
          new URL(response.headers.get('location') ?? baseURL).searchParams.has('error')
        ) {
          return c.json({ error: 'invalid_or_expired_link' as const }, 400);
        }
        for (const cookie of response.headers.getSetCookie()) {
          c.header('Set-Cookie', cookie, { append: true });
        }
        return c.json({ success: true });
      },
    )
    .on(['GET', 'POST'], '/*', (c) => auth.handler(c.req.raw));
}
