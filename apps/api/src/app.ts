import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { fileURLToPath } from 'node:url';

import type { Database } from './db/client';
import type { Auth } from './modules/auth';
import type { Environment } from './platform/env';

import { authCapabilities, authRoutes } from './modules/auth';
import { socialRoutes } from './modules/social';

export function createApp(db: Database, auth: Auth, env: Environment, ready: () => Promise<void>) {
  const origins = env.TRUSTED_ORIGINS.split(',').map((value) => value.trim());
  const browserOrigins = [
    new URL(env.BETTER_AUTH_URL).origin,
    ...origins.filter((origin) => origin.startsWith('http')),
  ];
  return new Hono()
    .use('*', secureHeaders())
    .get(
      '/sample-avatars/*',
      serveStatic({ root: fileURLToPath(new URL('../assets', import.meta.url)) }),
    )
    .use('/api/*', bodyLimit({ maxSize: 64 * 1024 }))
    .use('/api/*', cors({ origin: browserOrigins, credentials: true }))
    .use('/api/*', async (c, next) => {
      c.header('Cache-Control', 'no-store');
      const origin = c.req.header('origin');
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) &&
        origin &&
        !browserOrigins.includes(origin)
      ) {
        return c.json({ error: 'forbidden_origin' as const }, 403);
      }
      await next();
    })
    .get('/health', (c) => c.json({ status: 'ok' as const }))
    .get('/ready', async (c) => {
      try {
        await ready();
        return c.json({ status: 'ready' as const });
      } catch {
        return c.json({ status: 'unavailable' as const }, 503);
      }
    })
    .get('/.well-known/apple-app-site-association', (c) =>
      c.json({ webcredentials: { apps: env.APPLE_APP_ID ? [env.APPLE_APP_ID] : [] } }),
    )
    .get('/.well-known/assetlinks.json', (c) =>
      c.json(
        env.ANDROID_SHA256_CERT_FINGERPRINTS
          ? [
              {
                relation: ['delegate_permission/common.get_login_creds'],
                target: {
                  namespace: 'android_app',
                  package_name: 'com.kcvl.nuri',
                  sha256_cert_fingerprints: env.ANDROID_SHA256_CERT_FINGERPRINTS.split(','),
                },
              },
            ]
          : [],
      ),
    )
    .get('/api/auth-capabilities', (c) => c.json(authCapabilities(env)))
    .route('/api/auth', authRoutes(auth, env.BETTER_AUTH_URL))
    .route('/api', socialRoutes(db, auth))
    .onError((_error, c) => c.json({ error: 'internal_error' as const }, 500));
}
