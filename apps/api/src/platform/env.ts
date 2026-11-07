import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  TRUSTED_ORIGINS: z.string().default('com.kcvl.nuri://'),
  AUTH_EMULATE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  GOOGLE_EMULATOR_URL: z.url().optional(),
  APPLE_EMULATOR_URL: z.url().optional(),
  GOOGLE_EMULATOR_PUBLIC_URL: z.url().optional(),
  APPLE_EMULATOR_PUBLIC_URL: z.url().optional(),
  RESEND_API_URL: z.url().default('https://api.resend.com'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('nuri <login@example.com>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  PASSKEY_RP_ID: z.string().optional(),
  PASSKEY_ORIGINS: z.string().optional(),
  APPLE_APP_ID: z.string().optional(),
  ANDROID_SHA256_CERT_FINGERPRINTS: z.string().optional(),
});

export function readEnv(env: NodeJS.ProcessEnv = process.env) {
  const development = env.NODE_ENV === 'development';
  const result = schema.safeParse({
    ...env,
    BETTER_AUTH_URL:
      development && !env.BETTER_AUTH_URL?.trim() ? env.DEV_API_ORIGIN : env.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: development
      ? [env.TRUSTED_ORIGINS ?? 'com.kcvl.nuri://', env.DEV_METRO_ORIGIN].filter(Boolean).join(',')
      : env.TRUSTED_ORIGINS,
  });
  if (!result.success) {
    throw new Error(
      `Invalid server configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  if (
    result.data.NODE_ENV === 'production' &&
    !result.data.BETTER_AUTH_URL.startsWith('https://')
  ) {
    throw new Error('BETTER_AUTH_URL must use HTTPS in production');
  }
  validateEmulation(result.data);
  if (Boolean(result.data.GOOGLE_CLIENT_ID) !== Boolean(result.data.GOOGLE_CLIENT_SECRET)) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together');
  }
  if (
    result.data.NODE_ENV === 'production' &&
    result.data.RESEND_API_KEY &&
    result.data.EMAIL_FROM === 'nuri <login@example.com>'
  ) {
    throw new Error('EMAIL_FROM must use the configured Resend sender in production');
  }
  return result.data;
}

export type Environment = ReturnType<typeof readEnv>;

function validateEmulation(env: Environment) {
  if (env.AUTH_EMULATE) {
    if (env.NODE_ENV === 'production') {
      throw new Error('AUTH_EMULATE is only available in development and tests');
    }
    for (const key of [
      'GOOGLE_EMULATOR_URL',
      'APPLE_EMULATOR_URL',
      'RESEND_API_URL',
      ...(env.GOOGLE_EMULATOR_PUBLIC_URL ? ['GOOGLE_EMULATOR_PUBLIC_URL' as const] : []),
      ...(env.APPLE_EMULATOR_PUBLIC_URL ? ['APPLE_EMULATOR_PUBLIC_URL' as const] : []),
    ] as const) {
      const value = env[key];
      const host = value ? new URL(value).hostname : '';
      if (
        !['localhost', '127.0.0.1', 'google', 'apple', 'mail'].includes(host) &&
        !host.endsWith('.localhost')
      ) {
        throw new Error(`${key} must point to a local emulator`);
      }
    }
  } else if (env.RESEND_API_URL !== 'https://api.resend.com') {
    throw new Error('Custom mail endpoints require AUTH_EMULATE');
  }
}
