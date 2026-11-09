import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withBuildProperties } from 'expo-build-properties';

import withLocalhostCA from './plugins/with-localhost-ca.ts';

export default function configure({ config }: ConfigContext): ExpoConfig {
  // Expo loads app config before inlining public environment variables.
  if (!process.env.EXPO_PUBLIC_API_URL?.trim() && process.env.DEV_API_ORIGIN) {
    process.env.EXPO_PUBLIC_API_URL = process.env.DEV_API_ORIGIN;
  }
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const rpId = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];
  if (googleIosClientId) {
    plugins.push([
      'react-native-nitro-google-signin',
      { iosUrlScheme: googleIosClientId.split('.').reverse().join('.') },
    ]);
  }
  const nativeConfig = withLocalhostCA({
    ...config,
    name: config.name ?? 'nuri',
    slug: config.slug ?? 'nuri',
    plugins,
    ...(process.env.NURI_STAGING_RELEASE === '1'
      ? { updates: { ...config.updates, enabled: false } }
      : {}),
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    ios: {
      ...config.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
      ...(rpId ? { associatedDomains: [`webcredentials:${rpId}`] } : {}),
    },
  });
  if (googleIosClientId) {
    return nativeConfig;
  }

  // Autolinking installs Google Sign-In even when OAuth is unconfigured.
  return withBuildProperties(nativeConfig, {
    ios: {
      extraPods: [
        { name: 'AppCheckCore', modular_headers: true },
        { name: 'GoogleUtilities', modular_headers: true },
        { name: 'RecaptchaInterop', modular_headers: true },
      ],
    },
  });
}
