import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { createEmulator } from 'emulate';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { user } from './db/schema';
import { createAuth } from './modules/auth';
import { softwareAuthenticator } from './passkey-fixture';
import { readEnv } from './platform/env';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a migrated test database');
}
const { db, pool } = connectDatabase(databaseUrl);
const unique = crypto.randomUUID();
const email = `auth-${unique}@example.com`;
const secondEmail = `other-${unique}@example.com`;
const baseURL = 'http://localhost:8080';
const origin = 'http://localhost:8081';
const google = await createEmulator({
  service: 'google',
  port: 0,
  seed: {
    google: {
      users: [{ email, name: 'はなこ', email_verified: true }],
      oauth_clients: [
        {
          client_id: 'starter-local',
          client_secret: 'starter-local-secret',
          redirect_uris: [`${baseURL}/api/auth/callback/emulate-google`],
        },
      ],
    },
  },
});
const apple = await createEmulator({
  service: 'apple',
  port: 0,
  seed: {
    apple: {
      users: [{ email, name: 'はなこ' }],
      oauth_clients: [
        {
          client_id: 'starter-local',
          redirect_uris: [`${baseURL}/api/auth/callback/emulate-apple`],
        },
      ],
    },
  },
});
const mail = await createEmulator({
  service: 'resend',
  port: 0,
  seed: { resend: { domains: [{ name: 'example.com' }] } },
});
const env = readEnv({
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: 'integration-test-secret-never-use-in-production',
  BETTER_AUTH_URL: baseURL,
  TRUSTED_ORIGINS: `${origin},nuri://`,
  AUTH_EMULATE: 'true',
  GOOGLE_EMULATOR_URL: google.url,
  APPLE_EMULATOR_URL: apple.url,
  RESEND_API_URL: mail.url,
  PASSKEY_ORIGINS: origin,
  PASSKEY_RP_ID: 'localhost',
});
const auth = createAuth(db, env);
const app = createApp(db, auth, env, async () => {
  await pool.query('SELECT 1');
});
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
function request(path: string, body: unknown, cookie = '', method = 'POST') {
  return app.request(`${baseURL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify(body),
  });
}
afterAll(async () => {
  await db.delete(user).where(inArray(user.email, [email, secondEmail]));
  await Promise.all([pool.end(), google.close(), apple.close(), mail.close()]);
});

async function oauth(provider: 'google' | 'apple') {
  const start = await request('/api/auth/sign-in/social', {
    provider: `emulate-${provider}`,
    callbackURL: origin,
  });
  expect(start.status).toBe(200);
  const { url } = z.object({ url: z.url() }).parse(await start.json());
  const authorize = new URL(url);
  expect(authorize.searchParams.get('state')).toBeTruthy();
  expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
  const consent = await fetch(authorize);
  expect(consent.status).toBe(200);
  const body = new URLSearchParams(authorize.searchParams);
  body.set('email', email);
  const chosen = await fetch(
    `${provider === 'google' ? google.url : apple.url}${provider === 'google' ? '/o/oauth2/v2/auth/callback' : '/auth/authorize/callback'}`,
    { method: 'POST', body, redirect: 'manual' },
  );
  const location = chosen.headers.get('location');
  expect(location).toBeTruthy();
  if (!location) {
    throw new Error('Missing OAuth callback');
  }
  // A callback without the browser's state cookie must not create a session.
  const forged = await app.request(location);
  expect(cookies(forged)).not.toContain('session_token');
  const completed = await app.request(location, { headers: { cookie: cookies(start) } });
  expect(completed.headers.get('location')).toBe(origin);
  expect(cookies(completed)).toContain('session_token');
  return cookies(completed);
}

async function emailLink(recipient: string, native = false) {
  const callbackURL = native ? 'nuri://auth-callback?state=bound-device-state' : origin;
  const sent = await request('/api/auth/sign-in/magic-link', {
    email: recipient,
    name: 'メールのユーザー',
    callbackURL,
  });
  expect(sent.status).toBe(200);
  const inbox = z
    .object({ data: z.array(z.object({ id: z.string(), to: z.array(z.string()) })) })
    .parse(
      await (
        await fetch(`${mail.url}/emails`, { headers: { authorization: 'Bearer re_local_sample' } })
      ).json(),
    );
  const message = inbox.data.find((item) => item.to.includes(recipient));
  if (!message) {
    throw new Error('Email was not delivered to Emulate');
  }
  const delivered = z.object({ text: z.string() }).parse(
    await (
      await fetch(`${mail.url}/emails/${message.id}`, {
        headers: { authorization: 'Bearer re_local_sample' },
      })
    ).json(),
  );
  const link = delivered.text
    .split('\n')
    .find((line) => line.startsWith(native ? 'nuri://' : 'http://'));
  if (!link) {
    throw new Error('Missing email link');
  }
  return new URL(link);
}

test('Google/Apple OAuth use verified sessions and link the same verified email', async () => {
  const googleCookie = await oauth('google');
  const appleCookie = await oauth('apple');
  const first = z
    .object({ user: z.object({ id: z.string(), email: z.email() }) })
    .parse(await (await app.request('/api/me', { headers: { cookie: googleCookie } })).json());
  const second = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await app.request('/api/me', { headers: { cookie: appleCookie } })).json());
  expect(first.user.email).toBe(email);
  expect(second.user.id).toBe(first.user.id);
}, 20000);

test('magic links are single-use and sessions protect posts, likes and deletion', async () => {
  const link = await emailLink(email);
  const signedIn = await app.request(link.href);
  const cookie = cookies(signedIn);
  expect(cookie).toContain('session_token');
  expect(cookies(await app.request(link.href))).not.toContain('session_token');
  const nativeLink = await emailLink(secondEmail, true);
  expect(nativeLink.searchParams.get('state')).toBe('bound-device-state');
  const native = await request('/api/auth/mobile-magic-link', {
    token: nativeLink.searchParams.get('token'),
  });
  expect(native.status).toBe(200);
  const other = cookies(native);
  expect(other).toContain('session_token');
  expect(
    (await request('/api/auth/mobile-magic-link', { token: nativeLink.searchParams.get('token') }))
      .status,
  ).toBe(400);
  const created = await request('/api/posts', { body: '  今日もいい日でした。  ' }, cookie);
  expect(created.status).toBe(201);
  const { id } = z.object({ id: z.uuid() }).parse(await created.json());
  expect((await request(`/api/posts/${id}`, {}, other, 'DELETE')).status).toBe(404);
  await Promise.all([
    request(`/api/posts/${id}/like`, {}, other, 'PUT'),
    request(`/api/posts/${id}/like`, {}, other, 'PUT'),
  ]);
  const feed = z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          body: z.string(),
          likeCount: z.number(),
          liked: z.boolean(),
          author: z
            .object({ id: z.string(), name: z.string(), image: z.string().nullable() })
            .strict(),
        }),
      ),
    })
    .parse(await (await app.request('/api/posts', { headers: { cookie: other } })).json());
  expect(feed.items.find((item) => item.id === id)).toMatchObject({
    body: '今日もいい日でした。',
    likeCount: 1,
    liked: true,
  });
  const author = feed.items.find((item) => item.id === id)?.author;
  expect(author).toBeDefined();
  const publicProfile = await app.request(`/api/users/${author?.id}`);
  expect(publicProfile.status).toBe(200);
  expect(await publicProfile.json()).toEqual({ user: author });
  expect((await app.request('/api/users/missing-sample-user')).status).toBe(404);
  expect((await request('/api/posts', { body: ' '.repeat(5) }, cookie)).status).toBe(400);
  expect((await request('/api/auth/update-user', { name: 'x'.repeat(41) }, cookie)).status).toBe(
    400,
  );
  expect((await request(`/api/posts/${id}/like`, {}, other, 'DELETE')).status).toBe(200);
  expect((await request(`/api/posts/${id}`, {}, cookie, 'DELETE')).status).toBe(200);
  expect((await request('/api/auth/sign-out', {}, cookie)).status).toBe(200);
  expect((await app.request('/api/me', { headers: { cookie } })).status).toBe(401);
  expect((await request('/api/posts', { body: 'expired session' }, cookie)).status).toBe(401);
}, 20000);

test('passkeys require a session to register, verify signatures/origin, and can be removed', async () => {
  const authenticator = softwareAuthenticator();
  expect((await app.request('/api/auth/passkey/generate-register-options')).status).toBe(401);
  const cookie = await oauth('google');
  const registration = await app.request('/api/auth/passkey/generate-register-options', {
    headers: { cookie, origin },
  });
  expect(registration.status).toBe(200);
  const options = z.object({ challenge: z.string() }).parse(await registration.json());
  const registered = await request(
    '/api/auth/passkey/verify-registration',
    { name: 'テスト端末', response: authenticator.register(options.challenge, origin) },
    cookies(registration) + '; ' + cookie,
  );
  expect(registered.status).toBe(200);
  const passkey = z.object({ id: z.string() }).parse(await registered.json());
  async function optionsForLogin() {
    const response = await app.request('/api/auth/passkey/generate-authenticate-options', {
      headers: { origin },
    });
    const { challenge } = z.object({ challenge: z.string() }).parse(await response.json());
    return { challenge, cookie: cookies(response) };
  }
  const wrong = await optionsForLogin();
  const rejected = await request(
    '/api/auth/passkey/verify-authentication',
    { response: authenticator.authenticate(wrong.challenge, 'https://untrusted.example') },
    wrong.cookie,
  );
  expect(rejected.status).not.toBe(200);
  expect(cookies(rejected)).not.toContain('session_token');
  const valid = await optionsForLogin();
  const assertion = { response: authenticator.authenticate(valid.challenge, origin) };
  const signedIn = await request(
    '/api/auth/passkey/verify-authentication',
    assertion,
    valid.cookie,
  );
  expect(signedIn.status).toBe(200);
  expect((await app.request('/api/me', { headers: { cookie: cookies(signedIn) } })).status).toBe(
    200,
  );
  expect(
    (await request('/api/auth/passkey/verify-authentication', assertion, valid.cookie)).status,
  ).not.toBe(200);
  expect(
    (await request('/api/auth/passkey/delete-passkey', { id: passkey.id }, cookie)).status,
  ).toBe(200);
  const removed = await optionsForLogin();
  expect(
    (
      await request(
        '/api/auth/passkey/verify-authentication',
        { response: authenticator.authenticate(removed.challenge, origin, 2) },
        removed.cookie,
      )
    ).status,
  ).not.toBe(200);
}, 20000);
