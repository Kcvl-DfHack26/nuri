import { profilePhotoMaxBytes } from '@starter/shared';
import { afterAll, expect, spyOn, test } from 'bun:test';
import { eq, inArray, like, or } from 'drizzle-orm';
import { createEmulator } from 'emulate';
import sharp from 'sharp';
import { z } from 'zod';

import { createApp } from './app';
import { connectDatabase } from './db/client';
import { product, pushSubscription, rateLimit, recipe, session, user } from './db/schema';
import { createAuth } from './modules/auth';
import { createPushSender } from './modules/push';
import { softwareAuthenticator } from './passkey-fixture';
import { readEnv } from './platform/env';
import { createImageStore } from './platform/images';

const { DATABASE_URL: databaseUrl, GCS_BUCKET, STORAGE_EMULATOR_HOST } = process.env;
if (!databaseUrl || !GCS_BUCKET || !STORAGE_EMULATOR_HOST) {
  throw new Error('Set DATABASE_URL, GCS_BUCKET and STORAGE_EMULATOR_HOST for integration tests');
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
const followeeEmail = `followee-${unique}@example.com`;
// A new user's profile counts before anyone follows them or favorites their recipes.
const noFollowsOrLikes = { followerCount: 0, followingCount: 0, likeCount: 0, following: false };
const hiddenEmail = `hidden-${unique}@example.com`;
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
  GCS_BUCKET,
  STORAGE_EMULATOR_HOST,
  BETTER_AUTH_SECRET: 'integration-test-secret-never-use-in-production',
  BETTER_AUTH_URL: baseURL,
  TRUSTED_ORIGINS: `${origin},com.kcvl.nuri://`,
  AUTH_EMULATE: 'true',
  GOOGLE_EMULATOR_URL: google.url,
  RESEND_API_URL: mail.url,
  PASSKEY_ORIGINS: origin,
  PASSKEY_RP_ID: 'localhost',
  EXPO_PUSH_ACCESS_TOKEN: 'test-push-access-token',
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
    .where(
      inArray(user.email, [
        email,
        secondEmail,
        favoriteEmail,
        posterEmail,
        followeeEmail,
        hiddenEmail,
      ]),
    );
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

test('magic links are single-use and sessions protect profile updates', async () => {
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
  const publicProfile = await appRequest(`/api/users/${first.user.id}`);
  expect(publicProfile.status).toBe(200);
  const profileJson: unknown = await publicProfile.json();
  const author = z
    .object({ user: z.object({ id: z.string(), name: z.string(), image: z.string().nullable() }) })
    .parse(profileJson).user;
  expect(profileJson).toEqual({
    user: { ...author, handle: null, bio: '', isPublic: true, ...noFollowsOrLikes },
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
  const privateProfile = await appRequest(`/api/users/${author.id}`, { headers: { cookie } });
  expect(privateProfile.status).toBe(200);
  expect(await privateProfile.json()).toEqual({
    user: {
      ...author,
      name: 'はな',
      handle,
      bio: 'よろしく',
      isPublic: false,
      ...noFollowsOrLikes,
    },
  });
  expect((await request('/api/me/profile', { name: '更新後' }, cookie, 'PATCH')).status).toBe(200);
  // The face type (#194) is the owner's own: saved, cleared, validated, and not on /users/:id.
  const myFaceType = async () =>
    z
      .object({ profile: z.object({ faceType: z.string().nullable() }) })
      .parse(await (await appRequest('/api/me/profile', { headers: { cookie } })).json()).profile
      .faceType;
  expect(await myFaceType()).toBeNull();
  expect((await request('/api/me/profile', { faceType: 'round' }, cookie, 'PATCH')).status).toBe(
    200,
  );
  expect(await myFaceType()).toBe('round');
  expect(
    (await request('/api/me/profile', { faceType: 'round_yellow' }, cookie, 'PATCH')).status,
  ).toBe(400);
  expect(await myFaceType()).toBe('round');
  const afterFaceType = await appRequest(`/api/users/${author.id}`, { headers: { cookie } });
  expect(await afterFaceType.json()).not.toHaveProperty('user.faceType');
  expect((await request('/api/me/profile', { faceType: null }, cookie, 'PATCH')).status).toBe(200);
  expect(await myFaceType()).toBeNull();
  const afterPartialUpdate = await appRequest(`/api/users/${author.id}`, { headers: { cookie } });
  expect(await afterPartialUpdate.json()).toEqual({
    user: {
      ...author,
      name: '更新後',
      handle,
      bio: 'よろしく',
      isPublic: false,
      ...noFollowsOrLikes,
    },
  });
  expect((await appRequest(`/api/users/${author.id}`)).status).toBe(404);
  expect((await appRequest(`/api/users/${author.id}`, { headers: { cookie: other } })).status).toBe(
    404,
  );
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
  expect((await request('/api/auth/update-user', { name: 'x'.repeat(41) }, cookie)).status).toBe(
    400,
  );
  expect((await request('/api/auth/sign-out', {}, cookie)).status).toBe(200);
  expect((await appRequest('/api/me', { headers: { cookie } })).status).toBe(401);
  expect((await request('/api/me/profile', { name: '失効後' }, cookie, 'PATCH')).status).toBe(401);
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
  // The heart's count adds this one favorite to the recipe's carried-over popularity.
  const heart = z.object({ id: z.string(), favorited: z.boolean(), likeCount: z.number() });
  const detail = z
    .object({ recipe: heart })
    .parse(await (await appRequest(`/api/recipes/${recipeId}`, { headers: { cookie } })).json());
  expect(detail.recipe).toMatchObject({ favorited: true, likeCount: 1 });
  const guestDetail = z
    .object({ recipe: heart })
    .parse(await (await appRequest(`/api/recipes/${recipeId}`)).json());
  expect(guestDetail.recipe).toMatchObject({ favorited: false, likeCount: 1 });
  const list = z.object({ items: z.array(heart) });
  const favorites = list.parse(
    await (await appRequest('/api/me/favorites', { headers: { cookie } })).json(),
  );
  expect(favorites.items).toEqual([{ id: recipeId, favorited: true, likeCount: 1 }]);
  const authored = (author: string, headers?: { cookie: string }) =>
    appRequest(`/api/recipes?author=${author}`, headers ? { headers } : {});
  expect(list.parse(await (await authored(me.id, { cookie })).json()).items).toEqual([
    { id: recipeId, favorited: true, likeCount: 1 },
  ]);
  expect(list.parse(await (await authored(me.id)).json()).items).toEqual([
    { id: recipeId, favorited: false, likeCount: 1 },
  ]);
  expect((await request(`/api/recipes/${recipeId}/favorite`, {}, cookie, 'DELETE')).status).toBe(
    200,
  );
  expect(
    list.parse(await (await appRequest('/api/me/favorites', { headers: { cookie } })).json()).items,
  ).toEqual([]);
  expect(list.parse(await (await authored(me.id, { cookie })).json()).items).toEqual([
    { id: recipeId, favorited: false, likeCount: 0 },
  ]);
}, 20000);

test('follows are idempotent, only for public profiles and counted on profiles', async () => {
  const { cookie, me } = await signInRecipeUser();
  const followeeId = `followee-${unique}`;
  const hiddenId = `hidden-${unique}`;
  const recipeId = `followee-recipe-${unique}`;
  await db.insert(user).values([
    { id: followeeId, name: 'フォローされる人', email: followeeEmail },
    { id: hiddenId, name: '非公開の人', email: hiddenEmail, isPublic: false },
  ]);
  await db.insert(recipe).values({
    id: recipeId,
    authorId: followeeId,
    title: 'フォローのテスト',
    image: 'https://example.com/followee.jpg',
    durationMinutes: 5,
    likeCount: 10,
  });
  expect((await request(`/api/recipes/${recipeId}/favorite`, {}, cookie, 'PUT')).status).toBe(200);
  expect((await request(`/api/users/${me.id}/follow`, {}, cookie, 'PUT')).status).toBe(400);
  expect((await request(`/api/users/${hiddenId}/follow`, {}, cookie, 'PUT')).status).toBe(404);
  expect((await request('/api/users/missing-user/follow', {}, cookie, 'PUT')).status).toBe(404);
  expect((await request(`/api/users/${followeeId}/follow`, {}, '', 'PUT')).status).toBe(401);
  const followed = await Promise.all([
    request(`/api/users/${followeeId}/follow`, {}, cookie, 'PUT'),
    request(`/api/users/${followeeId}/follow`, {}, cookie, 'PUT'),
  ]);
  expect(followed.map((response) => response.status)).toEqual([200, 200]);

  const profile = z.object({
    user: z.object({
      followerCount: z.number(),
      followingCount: z.number(),
      likeCount: z.number(),
      following: z.boolean(),
    }),
  });
  const read = async (id: string, headers?: { cookie: string }) =>
    profile.parse(await (await appRequest(`/api/users/${id}`, headers ? { headers } : {})).json())
      .user;
  // 10 carried over plus this user's favorite.
  expect(await read(followeeId, { cookie })).toEqual({
    followerCount: 1,
    followingCount: 0,
    likeCount: 11,
    following: true,
  });
  expect((await read(followeeId)).following).toBe(false);
  expect(await read(me.id, { cookie })).toMatchObject({ followingCount: 1, following: false });

  expect((await request(`/api/users/${followeeId}/follow`, {}, cookie, 'DELETE')).status).toBe(200);
  expect(await read(followeeId, { cookie })).toMatchObject({ followerCount: 0, following: false });
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
    products: [{ name: 'ふんわりチーク', part: 'cheek', usage: 'チーク・コーラル' }],
    thumbnail: jpeg.toString('base64'),
  };
  expect((await request('/api/recipes', { ...valid, title: ' ' }, cookie)).status).toBe(400);

  const created = await request('/api/recipes', valid, cookie);
  expect(created.status).toBe(201);
  const { id } = z.object({ id: z.string().regex(/^p-[a-z0-9-]+$/) }).parse(await created.json());
  // A post resent after a lost response is saved once, with the latest contents and the painted
  // area read from the video; someone else's key is refused.
  const shape = { strokes: [{ fill: true, points: [{ at: 50 }, { at: 117 }, { at: 123 }] }] };
  const resent = await request(
    '/api/recipes',
    {
      ...valid,
      title: '二度目',
      steps: [{ ...step, shape }],
      products: [
        { name: '二度目のリップ', part: 'lip', usage: 'リップ・ローズ' },
        { name: '二度目の下地', part: 'base', usage: 'ベース' },
      ],
    },
    cookie,
  );
  expect(resent.status).toBe(201);
  expect(await resent.json()).toEqual({ id });
  expect(await (await appRequest(`/api/recipes/${id}`)).json()).toMatchObject({
    recipe: {
      title: '二度目',
      steps: [{ part: 'cheek', shape }],
      products: [
        { id: `${id}-0`, name: '二度目のリップ', image: '/product-kinds/lip.jpg' },
        // Base has no kind photo.
        { id: `${id}-1`, name: '二度目の下地', usage: 'ベース', image: null },
      ],
    },
  });
  // Unpublished cosmetics leave ⑤'s list empty.
  expect((await request('/api/recipes', { ...valid, products: undefined }, cookie)).status).toBe(
    201,
  );
  expect(await (await appRequest(`/api/recipes/${id}`)).json()).toMatchObject({
    recipe: { products: [] },
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
      // The published cosmetics, the poster's own words without a photo or a shop (#224).
      products: [
        {
          id: `${id}-0`,
          name: 'ふんわりチーク',
          usage: 'チーク・コーラル',
          image: '/product-kinds/cheek.jpg',
          purchaseUrl: null,
        },
      ],
    },
  });
  expect(
    await db
      .select({ id: product.id })
      .from(product)
      .where(like(product.id, `${id}-%`)),
  ).toEqual([{ id: `${id}-0` }]);
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
  const kindPhoto = await appRequest('/product-kinds/cheek.jpg');
  expect(kindPhoto.status).toBe(200);
  expect(kindPhoto.headers.get('content-type')).toBe('image/jpeg');
}, 20000);

test('updates only the signed-in profile after the photo is saved', async () => {
  const { cookie, me } = await signInRecipeUser();
  const previousImage = 'https://example.com/old.jpg';
  const ownerFilter = eq(user.id, me.id);
  await db.update(user).set({ image: previousImage }).where(ownerFilter);
  const recipeId = `p-${unique}`;
  await db.insert(recipe).values({
    id: recipeId,
    authorId: me.id,
    title: '作者の写真',
    image: 'https://example.com/recipe.jpg',
    durationMinutes: 3,
  });
  const getProfile = async () =>
    z
      .object({ user: z.object({ name: z.string(), image: z.string() }) })
      .parse(await (await appRequest(`/api/users/${me.id}`)).json()).user;
  const before = await getProfile();
  const photo = new Blob(
    [
      new Uint8Array(
        await sharp({ create: { width: 900, height: 600, channels: 3, background: '#FFC0CB' } })
          .withExif({ IFD0: { Copyright: 'private camera metadata' } })
          .jpeg()
          .toBuffer(),
      ),
    ],
    { type: 'image/jpeg' },
  );
  const upload = (asset: Blob, changes: unknown = {}, sessionCookie = cookie) => {
    const body = new FormData();
    body.set('photo', asset, 'profile.jpg');
    body.set('changes', JSON.stringify(changes));
    return { method: 'PATCH', body, headers: { origin, cookie: sessionCookie } };
  };
  const path = '/api/me/profile/photo';
  expect((await appRequest(path, upload(photo, {}, ''))).status).toBe(401);
  const malformed = await appRequest(path, {
    method: 'PATCH',
    body: 'invalid multipart data',
    headers: { origin, cookie, 'content-type': 'multipart/form-data; boundary=missing' },
  });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ error: 'invalid_request' });
  expect((await appRequest(path, upload(photo, { id: 'someone-else' }))).status).toBe(400);
  expect(
    (await appRequest(path, upload(photo, { image: 'https://example.com/spoof.jpg' }))).status,
  ).toBe(400);
  expect(
    (await appRequest(path, upload(new Blob(['not a photo'], { type: 'image/jpeg' })))).status,
  ).toBe(400);
  expect(
    (await appRequest(path, upload(new Blob([new Uint8Array(profilePhotoMaxBytes + 65536)]))))
      .status,
  ).toBe(413);
  expect(await getProfile()).toEqual(before);

  const images = createImageStore(env);
  const uploaded: string[] = [];
  try {
    expect((await appRequest(path, upload(photo, { name: '更新した名前' }))).status).toBe(200);
    const first = await getProfile();
    expect(first.name).toBe('更新した名前');
    expect(first.image).toMatch(/^\/media\/profiles\/[a-f0-9-]{36}\.jpg$/);
    uploaded.push(first.image);
    const served = await appRequest(first.image);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    const stored = await sharp(await served.arrayBuffer()).metadata();
    expect(stored.width).toBe(512);
    expect(stored.exif).toBeUndefined();
    expect(await (await appRequest(`/api/recipes/${recipeId}`)).json()).toMatchObject({
      recipe: { author: { image: first.image } },
    });
    expect(
      await (await appRequest('/api/auth/get-session', { headers: { cookie } })).json(),
    ).toMatchObject({ user: { image: first.image } });

    const failing = createApp(db, auth, { ...env, GCS_BUCKET: `missing-${unique}` }, () =>
      Promise.resolve(),
    );
    expect((await failing.request(path, upload(photo, { name: '失敗した変更' }))).status).toBe(500);
    expect(await getProfile()).toEqual(first);
    expect((await appRequest(first.image)).status).toBe(200);

    expect((await appRequest(path, upload(photo))).status).toBe(200);
    const second = await getProfile();
    uploaded.push(second.image);
    expect(second.image).not.toBe(first.image);
    expect((await appRequest(first.image)).status).toBe(404);
    expect((await appRequest(second.image)).status).toBe(200);
  } finally {
    await Promise.all(
      uploaded.map((image) =>
        images.file(image.slice('/media/'.length)).delete({ ignoreNotFound: true }),
      ),
    );
  }
}, 20000);

test('only new likes notify the owner and push subscriptions follow the active session', async () => {
  const { cookie: ownerCookie } = await signInRecipeUser();
  const actorCookie = await googleLogin();
  const owner = await auth.api.getSession({ headers: new Headers({ cookie: ownerCookie }) });
  const actor = await auth.api.getSession({ headers: new Headers({ cookie: actorCookie }) });
  if (!owner || !actor) {
    throw new Error('Push test users did not sign in');
  }
  const token = 'ExpoPushToken[owner-device]';
  const route = '/api/me/push-subscription';
  const subscription = { token, sessionId: owner.session.id };
  expect((await request(route, subscription, '', 'PUT')).status).toBe(401);
  expect((await request(route, subscription, actorCookie, 'PUT')).status).toBe(409);
  expect(
    (await request(route, { ...subscription, token: 'invalid' }, ownerCookie, 'PUT')).status,
  ).toBe(400);
  expect((await request(route, subscription, ownerCookie, 'PUT')).status).toBe(200);

  await db
    .update(user)
    .set({ name: 'みお', image: 'https://assets.example.com/mio.png', isPublic: true })
    .where(eq(user.id, actor.user.id));
  const recipeId = `push-${unique}`;
  await db.insert(recipe).values({
    id: recipeId,
    authorId: owner.user.id,
    title: '春のピンクメイク',
    image: 'https://assets.example.com/recipe.jpg',
    durationMinutes: 5,
  });
  const likePath = `/api/recipes/${recipeId}/favorite`;
  const sendPush = createPushSender(db, env.EXPO_PUSH_ACCESS_TOKEN, 'https://api.example.com');
  const requests: unknown[] = [];
  const fakeFetch = async (...[url, init]: Parameters<typeof fetch>) => {
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-push-access-token');
    if (typeof init?.body !== 'string') {
      throw new Error('Expected a JSON push request');
    }
    requests.push(JSON.parse(init.body));
    return Response.json({ data: [{ status: 'ok' }] });
  };
  const expo = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(fakeFetch, { preconnect: fetch.preconnect }),
  );

  try {
    expect((await request(likePath, {}, ownerCookie, 'PUT')).status).toBe(200);
    expect(expo).not.toHaveBeenCalled();

    const likes = await Promise.all([
      request(likePath, {}, actorCookie, 'PUT'),
      request(likePath, {}, actorCookie, 'PUT'),
    ]);
    expect(likes.map(({ status }) => status)).toEqual([200, 200]);
    expect(requests).toEqual([
      [
        expect.objectContaining({
          to: token,
          title: '❤️ みおさんがいいねしました',
          body: 'レシピ「春のピンクメイク」',
          channelId: 'likes',
          richContent: { image: 'https://assets.example.com/recipe.jpg' },
          mutableContent: true,
          data: { kind: 'recipe-liked', recipientId: owner.user.id, recipeId },
        }),
      ],
    ]);

    await request(likePath, {}, actorCookie, 'DELETE');
    expect(expo).toHaveBeenCalledTimes(1);
    expo.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect((await request(likePath, {}, actorCookie, 'PUT')).status).toBe(200);
    expect((await request(likePath, {}, actorCookie, 'PUT')).status).toBe(200);
    expect(expo).toHaveBeenCalledTimes(2);

    await db.update(user).set({ isPublic: false }).where(eq(user.id, actor.user.id));
    await request(likePath, {}, actorCookie, 'DELETE');
    expect((await request(likePath, {}, actorCookie, 'PUT')).status).toBe(200);
    expect(requests.at(-1)).toEqual([
      {
        to: token,
        title: '❤️ みおさんがいいねしました',
        body: 'レシピ「春のピンクメイク」',
        channelId: 'likes',
        data: { kind: 'recipe-liked', recipientId: owner.user.id, recipeId },
        richContent: { image: 'https://assets.example.com/recipe.jpg' },
        mutableContent: true,
        ttl: 3600,
      },
    ]);

    expect((await request('/api/recipes/missing/favorite', {}, actorCookie, 'PUT')).status).toBe(
      404,
    );
    expect(expo).toHaveBeenCalledTimes(3);
    await db
      .update(recipe)
      .set({ image: '/api/recipe-images/preview' })
      .where(eq(recipe.id, recipeId));
    await sendPush({
      kind: 'recipe-ready',
      recipientId: owner.user.id,
      recipeId,
    });
    expect(requests.at(-1)).toEqual([
      expect.objectContaining({
        to: token,
        title: '✨ 「春のピンクメイク」ができました',
        channelId: 'recipe-import',
        data: { kind: 'recipe-ready', recipientId: owner.user.id, recipeId },
        richContent: { image: 'https://api.example.com/api/recipe-images/preview' },
        mutableContent: true,
      }),
    ]);

    expo.mockResolvedValueOnce(
      Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    );
    await sendPush({ kind: 'recipe-failed', recipientId: owner.user.id });
    expect(
      await db.select().from(pushSubscription).where(eq(pushSubscription.token, token)),
    ).toEqual([]);
    expect((await request(route, subscription, ownerCookie, 'PUT')).status).toBe(200);

    // Logging in on the same installation can move the token, including after reinstall.
    expect(
      (await request(route, { token, sessionId: actor.session.id }, actorCookie, 'PUT')).status,
    ).toBe(200);
    expo.mockClear();
    await sendPush({ kind: 'recipe-started', recipientId: owner.user.id });
    expect(expo).not.toHaveBeenCalled();
    await sendPush({
      kind: 'recipe-started',
      recipientId: actor.user.id,
      recipeTitle: '春のピンクメイク',
    });
    expect(requests.at(-1)).toEqual([
      expect.objectContaining({
        to: token,
        title: '🎬 「春のピンクメイク」を作成しています',
        data: { kind: 'recipe-started', recipientId: actor.user.id },
      }),
    ]);

    expect((await request('/api/auth/sign-out', {}, actorCookie)).status).toBe(200);
    expect(
      await db.select().from(pushSubscription).where(eq(pushSubscription.token, token)),
    ).toEqual([]);
    expect((await request(route, subscription, ownerCookie, 'PUT')).status).toBe(200);
    await db
      .update(session)
      .set({ expiresAt: new Date(0) })
      .where(eq(session.id, owner.session.id));
    expo.mockClear();
    await sendPush({ kind: 'recipe-failed', recipientId: owner.user.id });
    expect(expo).not.toHaveBeenCalled();
  } finally {
    expo.mockRestore();
  }
}, 20000);
