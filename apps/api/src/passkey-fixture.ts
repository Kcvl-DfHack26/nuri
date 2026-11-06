// Test-only software authenticator: signs real WebAuthn ceremonies, without
// bypassing Better Auth or replacing its verification. Not an OS acceptance test.
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { z } from 'zod';

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest();
const base64 = (data: Uint8Array) => Buffer.from(data).toString('base64url');

export function softwareAuthenticator() {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = z
    .object({ x: z.string(), y: z.string() })
    .parse(keys.publicKey.export({ format: 'jwk' }));
  const credentialId = randomBytes(32);
  const coseKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(publicKey.x, 'base64url')],
      [-3, Buffer.from(publicKey.y, 'base64url')],
    ]),
  );
  return {
    register(challenge: string, origin: string) {
      const clientDataJSON = Buffer.from(
        JSON.stringify({ type: 'webauthn.create', challenge, origin }),
      );
      const authData = Buffer.concat([
        hash('localhost'),
        Buffer.from([0x45, 0, 0, 0, 0]),
        Buffer.alloc(16),
        Buffer.from([0, 32]),
        credentialId,
        coseKey,
      ]);
      const attestation = isoCBOR.encode(
        new Map<string, string | Uint8Array | Map<string, string>>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ]),
      );
      return {
        id: base64(credentialId),
        rawId: base64(credentialId),
        type: 'public-key',
        response: {
          clientDataJSON: base64(clientDataJSON),
          attestationObject: base64(attestation),
          transports: ['internal'],
        },
        clientExtensionResults: {},
      };
    },
    authenticate(challenge: string, origin: string, counter = 1) {
      const clientDataJSON = Buffer.from(
        JSON.stringify({ type: 'webauthn.get', challenge, origin }),
      );
      const count = Buffer.alloc(4);
      count.writeUInt32BE(counter);
      const authenticatorData = Buffer.concat([hash('localhost'), Buffer.from([0x05]), count]);
      const signature = sign(
        'sha256',
        Buffer.concat([authenticatorData, hash(clientDataJSON)]),
        keys.privateKey,
      );
      return {
        id: base64(credentialId),
        rawId: base64(credentialId),
        type: 'public-key',
        response: {
          clientDataJSON: base64(clientDataJSON),
          authenticatorData: base64(authenticatorData),
          signature: base64(signature),
        },
        clientExtensionResults: {},
      };
    },
  };
}
