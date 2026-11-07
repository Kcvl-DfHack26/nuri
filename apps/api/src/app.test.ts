import { afterAll, describe, expect, test } from 'bun:test';

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
    expect((await app.request('/api/posts?offset=-1')).status).toBe(400);
    expect((await app.request('/api/recipes?offset=-1')).status).toBe(400);
    expect((await app.request('/api/recipes/Not%20a%20slug')).status).toBe(400);
    expect((await app.request('/api/me')).status).toBe(401);
    expect(
      (
        await app.request('/api/posts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"body":"hello"}',
        })
      ).status,
    ).toBe(401);
  });
  test('rejects cross-origin writes and exposes only configured login methods', async () => {
    const rejected = await app.request('/api/posts', {
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
      apple: false,
      email: false,
      emulated: false,
    });
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
