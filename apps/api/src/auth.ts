import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import type { connectDatabase } from './db/client';
import type { readEnv } from './env';

import * as schema from './db/schema';

export function createAuth(
  db: ReturnType<typeof connectDatabase>['db'],
  env: ReturnType<typeof readEnv>,
) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    plugins: [expo()],
  });
}
