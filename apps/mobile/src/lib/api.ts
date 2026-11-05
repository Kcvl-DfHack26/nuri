import type { AppType } from '@starter/api/contract';

import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { hc } from 'hono/client';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
export const apiUrl = configuredUrl === '' ? null : (configuredUrl ?? null);

export const authClient = createAuthClient({
  baseURL: apiUrl ?? 'http://localhost:8080',
  plugins: [expoClient({ scheme: 'daylight', storagePrefix: 'daylight', storage: SecureStore })],
  fetchOptions: { timeout: 10000 },
});

export const api = hc<AppType>(apiUrl ?? 'http://localhost:8080', {
  headers: async () => ({ cookie: await authClient.getCookie() }),
});
