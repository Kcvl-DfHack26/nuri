import { createMiddleware } from 'hono/factory';

import type { Auth } from './service';

export type AuthenticatedEnv = {
  Variables: {
    currentUser: NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>['user'];
    sessionId: string;
  };
};

export function requireSession(auth: Auth) {
  return createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const current = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!current) {
      return c.json({ error: 'unauthorized' as const }, 401);
    }
    c.set('currentUser', current.user);
    c.set('sessionId', current.session.id);
    await next();
  });
}
