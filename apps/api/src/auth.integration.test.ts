import { afterAll, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { createApp } from './app';
import { createAuth } from './auth';
import { connectDatabase } from './db/client';
import { user } from './db/schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a migrated local/test database');
}
const { db, pool } = connectDatabase(databaseUrl);
const email = `integration-${crypto.randomUUID()}@example.com`;
const origin = 'http://localhost:8081';
const auth = createAuth(db, {
  NODE_ENV: 'test',
  PORT: 8080,
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: 'integration-test-secret-never-use-in-production',
  BETTER_AUTH_URL: 'http://localhost:8080',
  TRUSTED_ORIGINS: origin,
});
const app = createApp(auth, async () => {
  await pool.query('SELECT 1');
}, [origin]);
afterAll(async () => {
  await db.delete(user).where(eq(user.email, email));
  await pool.end();
});

test('sign up, reject wrong password, sign in, authorize and revoke session', async () => {
  const headers = { 'content-type': 'application/json', origin };
  const password = 'A-long-test-password-42!';
  const signup = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Integration Test', email, password }),
  });
  expect(signup.status).toBe(200);
  const wrong = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: 'incorrect-password' }),
  });
  expect(wrong.status).toBe(401);
  const signin = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  expect(signin.status).toBe(200);
  const cookie = signin.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  expect(cookie).toContain('session_token');
  const me = await app.request('/api/me', { headers: { cookie } });
  expect(me.status).toBe(200);
  expect(await me.json()).toMatchObject({ user: { email } });
  expect((await app.request('/ready')).status).toBe(200);
  const signout = await app.request('/api/auth/sign-out', {
    method: 'POST',
    headers: { ...headers, cookie },
    body: '{}',
  });
  expect(signout.status).toBe(200);
  expect((await app.request('/api/me', { headers: { cookie } })).status).toBe(401);
});
