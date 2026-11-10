import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { createAuth } from './modules/auth';
import { readEnv } from './platform/env';

const { db, pool } = connectDatabase('postgresql://unused:unused@127.0.0.1:1/unused');
const env = readEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'unused',
  BETTER_AUTH_SECRET: 'unit-test-secret-not-for-real-deployments',
  BETTER_AUTH_URL: 'http://localhost:8080',
  TRUSTED_ORIGINS: 'http://localhost:8081,com.kcvl.nuri://',
});
const auth = createAuth(db, env);
const app = createApp(db, auth, env, () => Promise.resolve());
afterAll(async () => {
  await pool.end();
});

describe('HTTP contract', () => {
  test('liveness is independent and readiness redacts errors', async () => {
    expect((await app.request('/health')).status).toBe(200);
    const unavailable = createApp(db, auth, env, () =>
      Promise.reject(new Error('private connection details')),
    );
    const response = await unavailable.request('/ready');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
  test('validates pagination and protects writes before touching the database', async () => {
    expect((await app.request('/api/recipes?offset=-1')).status).toBe(400);
    expect((await app.request('/api/recipes/Not%20a%20slug')).status).toBe(400);
    expect((await app.request('/api/recipes?part=nose')).status).toBe(400);
    expect((await app.request('/api/recipe-images/Not_A_Slug')).status).toBe(400);
    expect((await app.request('/api/me/favorites')).status).toBe(401);
    expect((await app.request('/api/recipes/fox/favorite', { method: 'PUT' })).status).toBe(401);
    expect((await app.request('/api/me')).status).toBe(401);
  });
  test.each([
    ['/api/auth/mobile-magic-link', 64 * 1024 + 1, 413],
    ['/api/recipes', 2.5 * 1024 * 1024, 401],
    ['/api/recipes', 2.5 * 1024 * 1024 + 1, 413],
    ['/api/post-analyses', 30_000_000 + 64 * 1024, 401],
    ['/api/post-analyses', 30_000_000 + 64 * 1024 + 1, 413],
  ])('checks the body limit and session for %s with %i bytes', async (path, size, status) => {
    const response = await app.request(path, { method: 'POST', body: 'a'.repeat(size) });
    expect(response.status).toBe(status);
  });
  test('rejects cross-origin writes and exposes only configured login methods', async () => {
    const rejected = await app.request('/api/recipes', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
    const allowed = await app.request('/api/auth-capabilities', {
      headers: { origin: 'http://localhost:8081' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(await allowed.json()).toEqual({
      google: false,
      email: false,
      emulated: false,
    });
  });
  test('allows the API origin in CORS and excludes the native login scheme', async () => {
    const sameOrigin = await app.request('/api/auth-capabilities', {
      headers: { origin: 'http://localhost:8080' },
    });
    expect(sameOrigin.headers.get('access-control-allow-origin')).toBe('http://localhost:8080');
    const nativeOrigin = await app.request('/api/auth-capabilities', {
      headers: { origin: 'com.kcvl.nuri://' },
    });
    expect(nativeOrigin.headers.get('access-control-allow-origin')).toBeNull();
  });
  test('opens a native login link from a tappable HTTPS page', async () => {
    const response = await app.request('/api/auth/open-mobile-link');
    expect(response.status).toBe(200);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain("script-src 'nonce-");
    const page = await response.text();
    expect(page).toContain('location.hash.slice(1)');
    expect(page).toContain('id="open"');
    expect(page).not.toContain('href="com.kcvl.nuri:');
  });
});

test('serves the Expo SPA without rewriting API, missing assets, or the future LP', async () => {
  const webRoot = await mkdtemp(join(tmpdir(), 'nuri-expo-web-'));
  try {
    const html = '<!doctype html><title>nuri</title>';
    const assets = join(webRoot, '_expo/static/js');
    await mkdir(assets, { recursive: true });
    await writeFile(join(webRoot, 'index.html'), html);
    await writeFile(join(assets, 'entry-hash.js'), 'console.log("nuri");');
    const hosted = createApp(db, auth, { ...env, EXPO_WEB_ROOT: webRoot }, () => Promise.resolve());

    expect((await app.request('/')).status).toBe(404);
    for (const path of ['/', '/recipes/fox/steps', '/auth-callback?next=/profile']) {
      const response = await hosted.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(await response.text()).toBe(html);
    }

    const head = await hosted.request('/recipes/fox', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');

    const entry = await hosted.request('/_expo/static/js/entry-hash.js');
    expect(entry.status).toBe(200);
    expect(entry.headers.get('content-type')).toContain('javascript');
    expect(entry.headers.get('cache-control')).toContain('immutable');
    expect(await entry.text()).toContain('console.log');
    const capabilities = await hosted.request('/api/auth-capabilities');
    expect(capabilities.headers.get('content-type')).toContain('application/json');
    expect((await hosted.request('/.well-known/assetlinks.json')).status).toBe(200);
    for (const path of [
      '/api/unknown',
      '/_expo/static/js/missing.js',
      '/assets/missing.png',
      '/recipes/fox/unknown',
      '/about/',
      '/unknown',
      '/settings',
    ]) {
      expect((await hosted.request(path)).status).toBe(404);
    }
    expect((await hosted.request('/', { method: 'POST' })).status).toBe(404);
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});
