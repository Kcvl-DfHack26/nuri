import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configure({ config }: ConfigContext): ExpoConfig {
  // Expo loads app config before inlining public environment variables.
  if (!process.env.EXPO_PUBLIC_API_URL?.trim() && process.env.DEV_API_ORIGIN) {
    process.env.EXPO_PUBLIC_API_URL = process.env.DEV_API_ORIGIN;
  }
  const rpId = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  return {
    ...config,
    name: config.name ?? 'expo-hono-opentofu-starter',
    slug: config.slug ?? 'expo-hono-opentofu-starter',
    ios: { ...config.ios, ...(rpId ? { associatedDomains: [`webcredentials:${rpId}`] } : {}) },
  };
}
