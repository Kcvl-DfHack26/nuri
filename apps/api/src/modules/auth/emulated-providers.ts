import { genericOAuth } from 'better-auth/plugins';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import type { Environment } from '../../platform/env';

const identity = z.object({
  sub: z.string(),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().optional(),
});

// Keep emulated identities separate from real Google accounts. Tokens still
// require a signature, audience, issuer, expiry and a verified email address.
export function emulatedProviders(env: Environment) {
  if (!env.AUTH_EMULATE) {
    return [];
  }
  const url = env.GOOGLE_EMULATOR_URL;
  if (!url) {
    throw new Error('Google emulator URL is missing');
  }
  const issuer = env.GOOGLE_EMULATOR_PUBLIC_URL ?? url;
  const keys = createRemoteJWKSet(new URL('/oauth2/v3/certs', url));
  return [
    genericOAuth({
      config: [
        {
          providerId: 'emulate-google',
          clientId: 'starter-local',
          clientSecret: 'starter-local-secret',
          authorizationUrl: `${issuer}/o/oauth2/v2/auth`,
          tokenUrl: `${url}/oauth2/token`,
          scopes: ['openid', 'email', 'profile'],
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
        },
      ],
    }),
  ];
}
