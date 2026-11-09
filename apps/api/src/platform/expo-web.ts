import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

// Only public Expo Router page paths fall back to index.html. Keep /about for the future LP.
const pages = [
  '/',
  '/account',
  '/auth-callback',
  '/diagnosis',
  '/import',
  '/parts/:part',
  '/post/cosmetics/:index',
  '/post/creating',
  '/post/done',
  '/post/message',
  '/post/preview',
  '/post/recording',
  '/post/review',
  '/post/step/:index',
  '/products/:id',
  '/profile',
  '/profile-settings',
  '/recipes/:id',
  '/recipes/:id/compare',
  '/recipes/:id/finish',
  '/recipes/:id/steps',
  '/record',
  '/search',
  '/suggest',
  '/users/:id',
];

export function expoWebRoutes(root: string | undefined) {
  const web = new Hono();
  if (!root) {
    return web;
  }
  web
    .on(
      ['GET', 'HEAD'],
      ['/_expo/static/*', '/assets/*'],
      cacheControl('public, max-age=31536000, immutable'),
      serveStatic({ root }),
    )
    .on(['GET', 'HEAD'], '/favicon.ico', serveStatic({ root }))
    .on(
      ['GET', 'HEAD'],
      pages,
      cacheControl('no-cache'),
      serveStatic({ root, path: 'index.html' }),
    );
  return web;
}

function cacheControl(value: string) {
  return createMiddleware(async (c, next) => {
    await next();
    if (c.res.ok) {
      c.header('Cache-Control', value);
    }
  });
}
