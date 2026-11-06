import { describe, expect, test } from 'bun:test';

import { readEnv } from './env';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://local/database',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  DEV_API_ORIGIN: 'http://api.checkout.localhost',
  DEV_METRO_ORIGIN: 'http://metro.checkout.localhost',
  TRUSTED_ORIGINS: 'expo-hono-opentofu-starter://,exp://**',
};

describe('API environment', () => {
  test('uses Compose origins when the development auth URL is empty', () => {
    const env = readEnv({ ...base, BETTER_AUTH_URL: '' });
    expect(env.BETTER_AUTH_URL).toBe(base.DEV_API_ORIGIN);
    expect(env.TRUSTED_ORIGINS.split(',')).toContain(base.DEV_METRO_ORIGIN);
  });

  test('keeps the explicitly configured HTTPS tunnel URL and trusted origins', () => {
    const env = readEnv({ ...base, BETTER_AUTH_URL: 'https://api.example.com' });
    expect(env.BETTER_AUTH_URL).toBe('https://api.example.com');
    expect(env.TRUSTED_ORIGINS.split(',')).toContain('exp://**');
  });

  test('requires an explicit HTTPS URL in production and excludes development origins', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      TRUSTED_ORIGINS: 'expo-hono-opentofu-starter://',
    };
    expect(() => readEnv({ ...production, BETTER_AUTH_URL: '' })).toThrow('BETTER_AUTH_URL');
    expect(() => readEnv({ ...production, BETTER_AUTH_URL: 'http://api.example.com' })).toThrow(
      'HTTPS',
    );
    const env = readEnv({
      ...production,
      BETTER_AUTH_URL: 'https://api.example.com',
    });
    expect(env.TRUSTED_ORIGINS).toBe(production.TRUSTED_ORIGINS);
  });

  test('invalid environment errors identify fields without leaking secret values', () => {
    expect(() => readEnv({ ...base, BETTER_AUTH_SECRET: 'private' })).toThrow('BETTER_AUTH_SECRET');
    try {
      readEnv({ ...base, BETTER_AUTH_SECRET: 'private' });
    } catch (error) {
      expect(String(error)).not.toContain('private');
    }
  });
});
