import type { AppType } from '@starter/api/contract';

import { expoClient } from '@better-auth/expo/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { hc } from 'hono/client';
import { Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const apiOrigin =
  Platform.OS === 'web' && configuredUrl === '/'
    ? globalThis.location?.origin
    : configuredUrl?.replace(/\/$/, '');
export const apiUrl = apiOrigin === '' ? null : (apiOrigin ?? null);
/** Resolves an image path served by the API (e.g. /sample-avatars/haru.jpg) to a full URL. */
export function apiAssetUrl(path: string) {
  return path.startsWith('/') && apiUrl ? `${apiUrl}${path}` : path;
}
export const authClient = createAuthClient({
  baseURL: apiUrl ?? 'http://localhost:8080',
  plugins: [
    expoClient({
      scheme: 'com.kcvl.nuri',
      storagePrefix: 'nuri',
      storage: SecureStore,
    }),
    magicLinkClient(),
    passkeyClient(),
  ],
  fetchOptions: { timeout: 10000 },
});
export const api = hc<AppType>(apiUrl ?? 'http://localhost:8080', {
  headers: async () => (Platform.OS === 'web' ? {} : { cookie: await authClient.getCookie() }),
  init: { credentials: Platform.OS === 'web' ? 'include' : 'omit' },
});
