import type { ConfigContext, ExpoConfig } from 'expo/config';

import withLocalhostCA from './plugins/with-localhost-ca.ts';

export default function configure({ config }: ConfigContext): ExpoConfig {
  // Expo loads app config before inlining public environment variables.
  if (!process.env.EXPO_PUBLIC_API_URL?.trim() && process.env.DEV_API_ORIGIN) {
    process.env.EXPO_PUBLIC_API_URL = process.env.DEV_API_ORIGIN;
  }
  const personalTeamRelease = process.env.NURI_IOS_PERSONAL_TEAM_RELEASE === '1';
  const appleTeamId = personalTeamRelease ? undefined : process.env.APPLE_TEAM_ID;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const rpId = personalTeamRelease ? undefined : process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  return withLocalhostCA({
    ...config,
    name: config.name ?? 'nuri',
    slug: config.slug ?? 'nuri',
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-notifications',
        {
          icon: './assets/plan-a/icons/notification.png',
          ...(personalTeamRelease ? { enableRemoteNotifications: false } : {}),
        },
      ],
      ...(personalTeamRelease ? [] : ['@bacons/apple-targets']),
    ],
    ...(process.env.NURI_STAGING_RELEASE === '1'
      ? { updates: { ...config.updates, enabled: false } }
      : {}),
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    ios: {
      ...config.ios,
      ...(personalTeamRelease ? { bundleIdentifier: 'dev.reohakase.nuri.staging' } : {}),
      ...(appleTeamId ? { appleTeamId } : {}),
      ...(rpId ? { associatedDomains: [`webcredentials:${rpId}`] } : {}),
    },
  });
}
