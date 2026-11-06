import { genericOAuth } from 'better-auth/plugins';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import type { Environment } from '../../platform/env';

const identity = z.object({
  sub: z.string(),
  email: z.email(),
  email_verified: z.union([z.literal(true), z.literal('true')]),
  name: z.string().optional(),
});

// Keep emulated identities separate from real provider accounts. Tokens still
// require a signature, audience, issuer, expiry and a verified email address.
export function emulatedProviders(env: Environment) {
  if (!env.AUTH_EMULATE) {
    return [];
  }
  const configurations = [
    {
      providerId: 'emulate-google',
      url: env.GOOGLE_EMULATOR_URL,
      publicUrl: env.GOOGLE_EMULATOR_PUBLIC_URL,
      authorize: '/o/oauth2/v2/auth',
      token: '/oauth2/token',
      jwks: '/oauth2/v3/certs',
    },
    {
      providerId: 'emulate-apple',
      url: env.APPLE_EMULATOR_URL,
      publicUrl: env.APPLE_EMULATOR_PUBLIC_URL,
      authorize: '/auth/authorize',
      token: '/auth/token',
      jwks: '/auth/keys',
    },
  ];
  return [
    genericOAuth({
      config: configurations.map((provider) => {
        if (!provider.url) {
          throw new Error('Emulator URL is missing');
        }
        const issuer = provider.publicUrl ?? provider.url;
        const keys = createRemoteJWKSet(new URL(provider.jwks, provider.url));
        return {
          providerId: provider.providerId,
          clientId: 'starter-local',
          clientSecret: 'starter-local-secret',
          authorizationUrl: `${issuer}${provider.authorize}`,
          tokenUrl: `${provider.url}${provider.token}`,
          scopes: [
            'openid',
            'email',
            ...(provider.providerId === 'emulate-google' ? ['profile'] : ['name']),
          ],
          pkce: true,
          getUserInfo: async (tokens) => {
            if (!tokens.idToken) {
              return null;
            }
            const { payload } = await jwtVerify(tokens.idToken, keys, {
              issuer,
              audience: 'starter-local',
              algorithms: ['RS256'],
            });
            const user = identity.parse(payload);
            return {
              id: user.sub,
              email: user.email,
              emailVerified: true,
              name: user.name ?? '新しいユーザー',
            };
          },
        };
      }),
    }),
  ];
}
