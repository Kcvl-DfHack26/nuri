import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  TRUSTED_ORIGINS: z.string().default('expo-hono-opentofu-starter://'),
});

export function readEnv(env: NodeJS.ProcessEnv = process.env) {
  const development = env.NODE_ENV === 'development';
  const result = schema.safeParse({
    ...env,
    BETTER_AUTH_URL:
      development && !env.BETTER_AUTH_URL?.trim() ? env.DEV_API_ORIGIN : env.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: development
      ? [env.TRUSTED_ORIGINS ?? 'expo-hono-opentofu-starter://', env.DEV_METRO_ORIGIN]
          .filter(Boolean)
          .join(',')
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
  return result.data;
}
