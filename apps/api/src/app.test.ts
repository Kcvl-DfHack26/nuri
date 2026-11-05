import { afterAll, describe, expect, test } from 'bun:test';

import { createApp } from './app';
import { createAuth } from './auth';
import { connectDatabase } from './db/client';

const { db, pool } = connectDatabase('postgresql://unused:unused@127.0.0.1:1/unused');
const auth = createAuth(db, {
  NODE_ENV: 'test',
  PORT: 8080,
  DATABASE_URL: 'unused',
  BETTER_AUTH_SECRET: 'unit-test-secret-not-for-real-deployments',
  BETTER_AUTH_URL: 'http://localhost:8080',
  TRUSTED_ORIGINS: 'http://localhost:8081,expo-hono-opentofu-starter://',
});
const app = createApp(auth, () => Promise.resolve(), ['http://localhost:8081']);
afterAll(async () => {
  await pool.end();
});

describe('HTTP contract', () => {
  test('liveness does not require a database', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
  test('readiness reports unavailable without leaking database errors', async () => {
    const unavailable = createApp(
      auth,
      () => Promise.reject(new Error('private connection details')),
      [],
    );
    const response = await unavailable.request('/ready');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
  test('validates query length and searches the catalog', async () => {
    expect((await app.request(`/api/rituals?q=${'x'.repeat(101)}`)).status).toBe(400);
    const response = await app.request('/api/rituals?q=chapter');
    expect(await response.json()).toMatchObject({ items: [{ id: 'read' }] });
  });
  test('requires a session and allows only configured browser origins', async () => {
    expect((await app.request('/api/me')).status).toBe(401);
    const response = await app.request('/api/rituals', {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    const allowed = await app.request('/api/rituals', {
      headers: { Origin: 'http://localhost:8081' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });
});
