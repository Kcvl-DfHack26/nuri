import { afterAll, expect, test } from 'bun:test';
import { inArray, like, or } from 'drizzle-orm';
import { createEmulator } from 'emulate';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { rateLimit, recipe, user } from './db/schema';
import { createAuth } from './modules/auth';
import { softwareAuthenticator } from './passkey-fixture';
import { readEnv } from './platform/env';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a migrated test database');
}
const { db, pool } = connectDatabase(databaseUrl);
const unique = crypto.randomUUID();
// Better Auth limits requests by client IP. Give each suite run its own private IPv6 subnet.
const testClientIp = `fd00:${unique.slice(0, 4)}:${unique.slice(4, 8)}:${unique.slice(9, 13)}:0000:0000:0000:0000`;
const providerTestClientIp = testClientIp.replace('fd00:', 'fd01:');
const email = `auth-${unique}@example.com`;
const secondEmail = `other-${unique}@example.com`;
const favoriteEmail = `favorite-${unique}@example.com`;
const posterEmail = `poster-${unique}@example.com`;
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
  TRUSTED_ORIGINS: `${origin},com.kcvl.nuri://`,
  AUTH_EMULATE: 'true',
  GOOGLE_EMULATOR_URL: google.url,
  RESEND_API_URL: mail.url,
  PASSKEY_ORIGINS: origin,
  PASSKEY_RP_ID: 'localhost',
});
const auth = createAuth(db, env);
const app = createApp(db, auth, env, async () => {
  await pool.query('SELECT 1');
});
function appRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('x-forwarded-for', testClientIp);
  return app.request(path, { ...init, headers });
}
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
function request(path: string, body: unknown, cookie = '', method = 'POST') {
  return appRequest(`${baseURL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin, cookie },
    body: JSON.stringify(body),
  });
}
afterAll(async () => {
  await db
    .delete(user)
    .where(inArray(user.email, [email, secondEmail, favoriteEmail, posterEmail]));
  await db
    .delete(rateLimit)
    .where(
      or(
        like(rateLimit.key, `${testClientIp}|%`),
        like(rateLimit.key, `${providerTestClientIp}|%`),
      ),
    );
  await Promise.all([pool.end(), google.close(), mail.close()]);
});

async function googleLogin() {
  const start = await request('/api/auth/sign-in/social', {
    provider: 'emulate-google',
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
  const chosen = await fetch(`${google.url}/o/oauth2/v2/auth/callback`, {
    method: 'POST',
    body,
    redirect: 'manual',
  });
  const location = chosen.headers.get('location');
  expect(location).toBeTruthy();
  if (!location) {
    throw new Error('Missing OAuth callback');
  }
  // A callback without the browser's state cookie must not create a session.
  const forged = await appRequest(location);
  expect(cookies(forged)).not.toContain('session_token');
  const completed = await appRequest(location, { headers: { cookie: cookies(start) } });
  expect(completed.headers.get('location')).toBe(origin);
  expect(cookies(completed)).toContain('session_token');
  return cookies(completed);
}

async function emailLink(recipient: string, native = false) {
  const callbackURL = native ? 'com.kcvl.nuri:///auth-callback?state=bound-device-state' : origin;
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
  const link = delivered.text.split('\n').find((line) => line.startsWith('http://'));
  if (!link) {
    throw new Error('Missing email link');
  }
  if (!native) {
    return new URL(link);
  }
  const open = new URL(link);
  expect(open.pathname).toBe('/api/auth/open-mobile-link');
  expect(open.search).toBe('');
  const callback = new URLSearchParams(open.hash.slice(1)).get('callback');
  if (!callback) {
    throw new Error('Missing app callback');
  }
  const landing = await appRequest(`${open.origin}${open.pathname}`);
  expect(landing.status).toBe(200);
  expect(landing.headers.get('referrer-policy')).toBe('no-referrer');
  expect(landing.headers.get('content-security-policy')).toContain('script-src');
  expect(await landing.text()).not.toContain(new URL(callback).searchParams.get('token') ?? '');
  return new URL(callback);
}

test('Apple OAuth is unavailable and Google rejects a forged native ID token', async () => {
  const productionAuth = createAuth(db, {
    ...env,
    AUTH_EMULATE: false,
    GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'test-secret',
  });
  const providerRequest = (body: unknown) =>
    productionAuth.handler(
      new Request(`${baseURL}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin,
          'x-forwarded-for': providerTestClientIp,
        },
        body: JSON.stringify(body),
      }),
    );
  for (const attempt of [
    { provider: 'apple' },
    { provider: 'google', idToken: { token: 'forged' } },
  ]) {
    const response = await providerRequest(attempt);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(cookies(response)).not.toContain('session_token');
  }
});

test('magic links are single-use and sessions protect posts, likes and deletion', async () => {
  const handle = `h_${unique.replaceAll('-', '').slice(0, 18)}`;
  const link = await emailLink(email.toUpperCase());
  const signedIn = await appRequest(link.href);
  const cookie = cookies(signedIn);
  expect(cookie).toContain('session_token');
  expect(cookies(await appRequest(link.href))).not.toContain('session_token');
  const googleCookie = await googleLogin();
  const sessionUser = z.object({ user: z.object({ id: z.string(), email: z.email() }) });
  const first = sessionUser.parse(
    await (await appRequest('/api/me', { headers: { cookie } })).json(),
  );
  const second = sessionUser.parse(
    await (await appRequest('/api/me', { headers: { cookie: googleCookie } })).json(),
  );
  expect(first.user.email).toBe(email);
  expect(second.user).toEqual(first.user);
  expect((await appRequest('/api/auth/list-accounts')).status).toBe(401);
  const accounts = await appRequest('/api/auth/list-accounts', {
    headers: { cookie },
  });
  expect(accounts.status).toBe(200);
  expect(await accounts.json()).toEqual([
    expect.objectContaining({ providerId: 'emulate-google', userId: first.user.id }),
  ]);

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
  const feedSchema = z.object({
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
  });
  const feed = feedSchema.parse(
    await (await appRequest('/api/posts', { headers: { cookie: other } })).json(),
  );
  expect(feed.items.find((item) => item.id === id)).toMatchObject({
    body: '今日もいい日でした。',
    likeCount: 1,
    liked: true,
  });
  const guestFeed = feedSchema.parse(await (await appRequest('/api/posts')).json());
  expect(guestFeed.items.find((item) => item.id === id)).toMatchObject({
    likeCount: 1,
    liked: false,
  });
  const author = feed.items.find((item) => item.id === id)?.author;
  expect(author).toBeDefined();
  const publicProfile = await appRequest(`/api/users/${author?.id}`);
  expect(publicProfile.status).toBe(200);
  expect(await publicProfile.json()).toEqual({
    user: { ...author, handle: null, bio: '', isPublic: true },
  });
  expect((await appRequest('/api/me/profile')).status).toBe(401);
  expect(
    (
      await request(
        '/api/me/profile',
        { name: 'はな', handle: 'Bad ID', bio: '', isPublic: false },
        cookie,
        'PATCH',
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        '/api/me/profile',
        { name: 'はな', handle, bio: 'よろしく', isPublic: false },
        cookie,
        'PATCH',
      )
    ).status,
  ).toBe(200);
  const privateProfile = await appRequest(`/api/users/${author?.id}`, { headers: { cookie } });
  expect(privateProfile.status).toBe(200);
  expect(await privateProfile.json()).toEqual({
    user: { ...author, name: 'はな', handle, bio: 'よろしく', isPublic: false },
  });
  expect((await request('/api/me/profile', { name: '更新後' }, cookie, 'PATCH')).status).toBe(200);
  const afterPartialUpdate = await appRequest(`/api/users/${author?.id}`, { headers: { cookie } });
  expect(await afterPartialUpdate.json()).toEqual({
    user: { ...author, name: '更新後', handle, bio: 'よろしく', isPublic: false },
  });
  expect((await appRequest(`/api/users/${author?.id}`)).status).toBe(404);
  expect(
    (await appRequest(`/api/users/${author?.id}`, { headers: { cookie: other } })).status,
  ).toBe(404);
  expect(
    (
      await request(
        '/api/me/profile',
        { name: '別の人', handle, bio: '', isPublic: true },
        other,
        'PATCH',
      )
    ).status,
  ).toBe(409);
  expect((await appRequest('/api/users/missing-sample-user')).status).toBe(404);
  expect((await request('/api/posts', { body: ' '.repeat(5) }, cookie)).status).toBe(400);
  expect((await request('/api/auth/update-user', { name: 'x'.repeat(41) }, cookie)).status).toBe(
    400,
  );
  expect((await request(`/api/posts/${id}/like`, {}, other, 'DELETE')).status).toBe(200);
  expect((await request(`/api/posts/${id}`, {}, cookie, 'DELETE')).status).toBe(200);
  expect((await request('/api/auth/sign-out', {}, cookie)).status).toBe(200);
  expect((await appRequest('/api/me', { headers: { cookie } })).status).toBe(401);
  expect((await request('/api/posts', { body: 'expired session' }, cookie)).status).toBe(401);
}, 20000);

test('passkeys require a session to register, verify signatures/origin, and can be removed', async () => {
  const authenticator = softwareAuthenticator();
  expect((await appRequest('/api/auth/passkey/generate-register-options')).status).toBe(401);
  const cookie = await googleLogin();
  const registration = await appRequest('/api/auth/passkey/generate-register-options', {
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
    const response = await appRequest('/api/auth/passkey/generate-authenticate-options', {
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
  expect((await appRequest('/api/me', { headers: { cookie: cookies(signedIn) } })).status).toBe(
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

// Magic links allow five sign-ins a minute, so the recipe tests share one signed-in user.
let recipeUser: Promise<{ cookie: string; me: { id: string } }> | undefined;
function signInRecipeUser() {
  recipeUser ??= (async () => {
    const cookie = cookies(await appRequest((await emailLink(favoriteEmail)).href));
    const { user: me } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await appRequest('/api/me', { headers: { cookie } })).json());
    return { cookie, me };
  })();
  return recipeUser;
}

test('favorites are idempotent and only visible to the user who added them', async () => {
  const { cookie, me } = await signInRecipeUser();
  const recipeId = `favorite-${unique}`;
  await db.insert(recipe).values({
    id: recipeId,
    authorId: me.id,
    title: 'お気に入りのテスト',
    image: 'https://example.com/favorite.jpg',
    durationMinutes: 5,
  });
  expect((await request('/api/recipes/missing-recipe/favorite', {}, cookie, 'PUT')).status).toBe(
    404,
  );
  const added = await Promise.all([
    request(`/api/recipes/${recipeId}/favorite`, {}, cookie, 'PUT'),
    request(`/api/recipes/${recipeId}/favorite`, {}, cookie, 'PUT'),
  ]);
  expect(added.map((response) => response.status)).toEqual([200, 200]);
  const detail = z
    .object({ recipe: z.object({ favorited: z.boolean() }) })
    .parse(await (await appRequest(`/api/recipes/${recipeId}`, { headers: { cookie } })).json());
  expect(detail.recipe.favorited).toBe(true);
  const guestDetail = z
    .object({ recipe: z.object({ favorited: z.boolean() }) })
    .parse(await (await appRequest(`/api/recipes/${recipeId}`)).json());
  expect(guestDetail.recipe.favorited).toBe(false);
  const list = z.object({ items: z.array(z.object({ id: z.string() })) });
  const favorites = list.parse(
    await (await appRequest('/api/me/favorites', { headers: { cookie } })).json(),
  );
  expect(favorites.items.map((item) => item.id)).toEqual([recipeId]);
  const authored = list.parse(await (await appRequest(`/api/recipes?author=${me.id}`)).json());
  expect(authored.items.map((item) => item.id)).toEqual([recipeId]);
  expect((await request(`/api/recipes/${recipeId}/favorite`, {}, cookie, 'DELETE')).status).toBe(
    200,
  );
  expect(
    list.parse(await (await appRequest('/api/me/favorites', { headers: { cookie } })).json()).items,
  ).toEqual([]);
}, 20000);

test('posting a recipe validates and stores the latest draft and serves its thumbnail', async () => {
  const { cookie, me } = await signInRecipeUser();
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);
  const step = {
    part: 'cheek',
    label: 'チーク',
    title: '頬に入れる',
    description: '頬骨の上に高めに',
    uses: 'ふんわりチーク',
    color: '#E8968A',
  };
  const valid = {
    key: crypto.randomUUID(),
    title: '  投稿のテスト  ',
    summary: 'チークを高めに',
    tags: ['時短'],
    durationMinutes: 3,
    steps: [step, { ...step, part: 'lip', label: 'リップ', description: '' }],
    thumbnail: jpeg.toString('base64'),
  };
  expect((await request('/api/recipes', { ...valid, title: ' ' }, cookie)).status).toBe(400);

  const created = await request('/api/recipes', valid, cookie);
  expect(created.status).toBe(201);
  const { id } = z.object({ id: z.string().regex(/^p-[a-z0-9-]+$/) }).parse(await created.json());
  // A post resent after a lost response is saved once, with the latest contents; someone else's
  // key is refused.
  const resent = await request(
    '/api/recipes',
    { ...valid, title: '二度目', steps: [step] },
    cookie,
  );
  expect(resent.status).toBe(201);
  expect(await resent.json()).toEqual({ id });
  expect(await (await appRequest(`/api/recipes/${id}`)).json()).toMatchObject({
    recipe: { title: '二度目', steps: [{ part: 'cheek' }] },
  });
  expect((await request('/api/recipes', valid, cookie)).status).toBe(201);
  const otherKey = crypto.randomUUID();
  await db.insert(user).values({ id: `poster-${unique}`, name: 'ほかの人', email: posterEmail });
  await db.insert(recipe).values({
    id: `p-${otherKey}`,
    authorId: `poster-${unique}`,
    title: 'ほかの人の投稿',
    image: 'https://example.com/other.jpg',
    durationMinutes: 3,
  });
  expect((await request('/api/recipes', { ...valid, key: otherKey }, cookie)).status).toBe(409);
  const detail = await appRequest(`/api/recipes/${id}`);
  expect(await detail.json()).toMatchObject({
    recipe: {
      id,
      title: '投稿のテスト',
      image: `/api/recipe-images/${id}`,
      tags: ['時短'],
      durationMinutes: 3,
      likeCount: 0,
      source: null,
      part: null,
      summary: 'チークを高めに',
      author: { id: me.id },
      steps: [
        {
          part: 'cheek',
          label: 'チーク',
          title: '頬に入れる',
          hint: '頬骨の上に高めに',
          product: 'ふんわりチーク',
          colors: ['#E8968A'],
        },
        { part: 'lip', label: 'リップ', hint: '' },
      ],
    },
  });
  const list = z.object({ items: z.array(z.object({ id: z.string() })) });
  expect(
    list.parse(await (await appRequest('/api/recipes')).json()).items.map((item) => item.id),
  ).toContain(id);
  expect(
    list
      .parse(await (await appRequest(`/api/recipes?author=${me.id}`)).json())
      .items.map((item) => item.id),
  ).toContain(id);

  const image = await appRequest(`/api/recipe-images/${id}`);
  expect(image.status).toBe(200);
  expect(image.headers.get('content-type')).toBe('image/jpeg');
  expect(image.headers.get('x-content-type-options')).toBe('nosniff');
  expect(image.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(Buffer.from(await image.arrayBuffer())).toEqual(jpeg);
  expect((await appRequest('/api/recipe-images/fox')).status).toBe(404);
}, 20000);
