import type { ConfigContext, ExpoConfig } from 'expo/config';

import withLocalhostCA from './plugins/with-localhost-ca.ts';

export default function configure({ config }: ConfigContext): ExpoConfig {
  // Expo loads app config before inlining public environment variables.
  if (!process.env.EXPO_PUBLIC_API_URL?.trim() && process.env.DEV_API_ORIGIN) {
    process.env.EXPO_PUBLIC_API_URL = process.env.DEV_API_ORIGIN;
  }
  const rpId = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  return withLocalhostCA({
    ...config,
    name: config.name ?? 'nuri',
    slug: config.slug ?? 'nuri',
    ios: { ...config.ios, ...(rpId ? { associatedDomains: [`webcredentials:${rpId}`] } : {}) },
  });
}
