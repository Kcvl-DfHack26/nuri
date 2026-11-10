import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { profileInputSchema } from '@starter/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';

import type { Database } from '../../db/client';
import type { Environment } from '../../platform/env';

import * as schema from '../../db/schema';
import { emulatedProviders } from './emulated-providers';
import { sendLoginEmail } from './mail';

export function authCapabilities(env: Environment) {
  return {
    google: env.AUTH_EMULATE || Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    email: env.AUTH_EMULATE || Boolean(env.RESEND_API_KEY),
    emulated: env.AUTH_EMULATE,
  };
}

export function createAuth(db: Database, env: Environment) {
  return betterAuth({
    appName: 'nuri',
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/update-user') {
          const parsed = profileInputSchema.pick({ name: true }).safeParse(ctx.body);
          if (!parsed.success) {
            throw new APIError('BAD_REQUEST', {
              message: 'Display name must contain 1 to 40 characters',
            });
          }
          ctx.body = parsed.data;
        }
      }),
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    socialProviders:
      !env.AUTH_EMULATE && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    plugins: [
      expo(),
      passkey({
        rpID: env.PASSKEY_RP_ID ?? new URL(env.BETTER_AUTH_URL).hostname,
        rpName: 'nuri',
        origin: (env.PASSKEY_ORIGINS ?? env.BETTER_AUTH_URL)
          .split(',')
          .map((value) => value.trim()),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      }),
      ...(authCapabilities(env).email
        ? [
            magicLink({
              expiresIn: 600,
              storeToken: 'hashed',
              sendMagicLink: ({ email, url }) => sendLoginEmail(env, email, url),
            }),
          ]
        : []),
      ...emulatedProviders(env),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
