import { describe, expect, test } from 'bun:test';

import { readEnv } from './env';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://local/database',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  DEV_API_ORIGIN: 'https://api.checkout.localhost',
  DEV_METRO_ORIGIN: 'https://metro.checkout.localhost',
  TRUSTED_ORIGINS: ' com.kcvl.nuri:// , , exp://** ',
};

describe('API environment', () => {
  test('uses Compose origins when the development auth URL is empty', () => {
    const env = readEnv({ ...base, BETTER_AUTH_URL: '' });
    expect(env.BETTER_AUTH_URL).toBe(base.DEV_API_ORIGIN);
    expect(env.TRUSTED_ORIGINS).toEqual(['com.kcvl.nuri://', 'exp://**', base.DEV_METRO_ORIGIN]);
  });

  test('keeps the explicitly configured HTTPS tunnel URL and trusted origins', () => {
    const env = readEnv({ ...base, BETTER_AUTH_URL: 'https://api.example.com' });
    expect(env.BETTER_AUTH_URL).toBe('https://api.example.com');
    expect(env.TRUSTED_ORIGINS).toContain('exp://**');
  });

  test('uses the native origin by default and respects an explicitly empty list', () => {
    const settings = { ...base, NODE_ENV: 'test', BETTER_AUTH_URL: 'http://localhost:8080' };
    expect(readEnv({ ...settings, TRUSTED_ORIGINS: undefined }).TRUSTED_ORIGINS).toEqual([
      'com.kcvl.nuri://',
    ]);
    expect(readEnv({ ...settings, TRUSTED_ORIGINS: '' }).TRUSTED_ORIGINS).toEqual([]);
  });

  test('requires an explicit HTTPS URL in production and excludes development origins', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      TRUSTED_ORIGINS: 'com.kcvl.nuri://',
    };
    expect(() => readEnv({ ...production, BETTER_AUTH_URL: '' })).toThrow('BETTER_AUTH_URL');
    expect(() => readEnv({ ...production, BETTER_AUTH_URL: 'http://api.example.com' })).toThrow(
      'HTTPS',
    );
    const env = readEnv({
      ...production,
      BETTER_AUTH_URL: 'https://api.example.com',
    });
    expect(env.TRUSTED_ORIGINS).toEqual([production.TRUSTED_ORIGINS]);
  });

  test('invalid environment errors identify fields without leaking secret values', () => {
    expect(() => readEnv({ ...base, BETTER_AUTH_SECRET: 'private' })).toThrow('BETTER_AUTH_SECRET');
    try {
      readEnv({ ...base, BETTER_AUTH_SECRET: 'private' });
    } catch (error) {
      expect(String(error)).not.toContain('private');
    }
  });

  test('requires both Google OAuth credentials when using a real provider', () => {
    expect(() => readEnv({ ...base, GOOGLE_CLIENT_ID: 'client-id' })).toThrow(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    );
    expect(() => readEnv({ ...base, GOOGLE_CLIENT_SECRET: 'private-secret' })).toThrow(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    );
    expect(() =>
      readEnv({ ...base, GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'private-secret' }),
    ).not.toThrow();
    expect(() =>
      readEnv({ ...base, GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 'private-secret' }),
    ).toThrow('GOOGLE_CLIENT_ID');
  });

  test('requires a configured sender when production email login is enabled', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.example.com',
      RESEND_API_KEY: 'private-key',
    };
    expect(() => readEnv(production)).toThrow('EMAIL_FROM');
    expect(() => readEnv({ ...production, EMAIL_FROM: 'nuri <login@nuri.example>' })).not.toThrow();
    expect(() => readEnv({ ...production, EMAIL_FROM: '  ' })).toThrow('EMAIL_FROM');
    expect(() => readEnv({ ...production, RESEND_API_KEY: ' ' })).toThrow('RESEND_API_KEY');
  });
});

test('emulation cannot be enabled in production or point to public services', () => {
  const emulated = {
    ...base,
    AUTH_EMULATE: 'true',
    GOOGLE_EMULATOR_URL: 'http://localhost:4002',
    RESEND_API_URL: 'http://localhost:4005',
  };
  expect(readEnv(emulated).AUTH_EMULATE).toBe(true);
  expect(() =>
    readEnv({ ...emulated, NODE_ENV: 'production', BETTER_AUTH_URL: 'https://api.example.com' }),
  ).toThrow('only available');
  expect(() =>
    readEnv({ ...emulated, GOOGLE_EMULATOR_URL: 'https://accounts.google.com' }),
  ).toThrow('local emulator');
  expect(() => readEnv({ ...base, RESEND_API_URL: 'https://untrusted.example' })).toThrow(
    'Custom mail endpoints',
  );
});
