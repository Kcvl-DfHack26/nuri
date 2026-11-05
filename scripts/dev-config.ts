import { z } from 'zod';

export const projectName = 'expo-hono-opentofu-starter';
// Compose permits escaped apostrophes in single-quoted paths; node:util keeps the slash.
const composePath = z
  .string()
  .min(1)
  .transform((value) => value.replaceAll("\\'", "'"));

export const worktreeSchema = z.object({
  WORKTREE_ID: z.string().regex(/^[a-f0-9]{12}$/),
  WORKTREE_ROOT: composePath,
  WORKTREE_GIT_COMMON_DIR: composePath,
  COMPOSE_PROJECT_NAME: z.string().regex(/^expo-hono-opentofu-starter-[a-f0-9]{12}$/),
});

export function serviceName(service: 'api' | 'metro', id: string) {
  return `${service}.${id}.${projectName}`;
}

export function databaseUrl(binding: string) {
  const match = /^127\.0\.0\.1:(\d+)$/.exec(binding.trim());
  const port = z.coerce.number().int().min(1).max(65535).parse(match?.[1]);
  return `postgresql://${projectName}:starter@127.0.0.1:${port}/${projectName}`;
}

export function apiEnvironment(
  env: NodeJS.ProcessEnv,
  id: string,
  database: string,
): NodeJS.ProcessEnv & {
  DATABASE_URL: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS: string;
} {
  const configuredUrl = env.BETTER_AUTH_URL?.trim();
  const defaultUrl = env.PORTLESS_URL ?? 'http://localhost:8080';
  const authUrl = z.url().parse(configuredUrl?.length ? configuredUrl : defaultUrl);
  const origins = new Set([
    `${projectName}://`,
    'exp://**',
    `http://${serviceName('metro', id)}.localhost`,
    new URL(authUrl).origin,
    ...(env.TRUSTED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
  return {
    ...env,
    DATABASE_URL: database,
    BETTER_AUTH_URL: authUrl,
    TRUSTED_ORIGINS: [...origins].join(','),
  };
}
