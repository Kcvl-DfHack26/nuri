import { serveStatic } from '@hono/node-server/serve-static';
import { postAnalysisVideoMaxBytes } from '@starter/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { fileURLToPath } from 'node:url';

import type { Database } from './db/client';
import type { Auth } from './modules/auth';
import type { PostAnalyzer } from './modules/post-analysis';
import type { Environment } from './platform/env';

import { authCapabilities, authRoutes, requireSession } from './modules/auth';
import { postAnalysisRoutes } from './modules/post-analysis';
import { createPushSender, pushRoutes } from './modules/push';
import { recipeRoutes } from './modules/recipes';
import { socialRoutes } from './modules/social';
import { expoWebRoutes } from './platform/expo-web';

export function createApp(
  db: Database,
  auth: Auth,
  env: Environment,
  ready: () => Promise<void>,
  analyzePost: PostAnalyzer | null = null,
) {
  const origins = env.TRUSTED_ORIGINS.split(',').map((value) => value.trim());
  const browserOrigins = [
    new URL(env.BETTER_AUTH_URL).origin,
    ...origins.filter((origin) => origin.startsWith('http')),
  ];
  // Answer 413 instead of letting the thrown HTTPException become a 500 in onError.
  const onError: Parameters<typeof bodyLimit>[0]['onError'] = (c) =>
    c.json({ error: 'payload_too_large' as const }, 413);
  const smallBody = bodyLimit({ maxSize: 64 * 1024, onError });
  // POST /api/recipes carries a base64 JPEG of up to 1.5 MB (2 MB as base64) plus the texts.
  const postedRecipeBody = bodyLimit({ maxSize: 2.5 * 1024 * 1024, onError });
  // POST /api/post-analyses carries the video from ⑫-3 and its marks as multipart form data.
  const postVideoBody = bodyLimit({ maxSize: postAnalysisVideoMaxBytes + 64 * 1024, onError });
  return (
    new Hono()
      .use('*', secureHeaders())
      .get(
        '/sample-avatars/*',
        serveStatic({ root: fileURLToPath(new URL('../assets', import.meta.url)) }),
      )
      .get(
        '/sample-recipes/*',
        serveStatic({ root: fileURLToPath(new URL('../assets', import.meta.url)) }),
      )
      // ⑤'s photo for a posted cosmetic, one per kind (#224).
      .get(
        '/product-kinds/*',
        serveStatic({ root: fileURLToPath(new URL('../assets', import.meta.url)) }),
      )
      // A posted recipe carries its thumbnail; every other API body stays small.
      .use('/api/*', (c, next) => {
        if (c.req.method === 'POST' && c.req.path === '/api/recipes') {
          return postedRecipeBody(c, next);
        }
        if (c.req.method === 'POST' && c.req.path === '/api/post-analyses') {
          return postVideoBody(c, next);
        }
        return smallBody(c, next);
      })
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
      .route('/api', pushRoutes(db, auth, env.EXPO_PUSH_ACCESS_TOKEN))
      .route(
        '/api',
        recipeRoutes(
          db,
          auth,
          createPushSender(db, env.EXPO_PUSH_ACCESS_TOKEN, env.BETTER_AUTH_URL),
        ),
      )
      .route('/api', socialRoutes(db, auth))
      .route('/api', postAnalysisRoutes(requireSession(auth), analyzePost))
      .route('/', expoWebRoutes(env.EXPO_WEB_ROOT))
      .onError((_error, c) => c.json({ error: 'internal_error' as const }, 500))
  );
}
