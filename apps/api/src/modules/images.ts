import { ApiError, Storage } from '@google-cloud/storage';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import type { Environment } from '../platform/env';

export function createImageStore(env: Pick<Environment, 'GCS_BUCKET' | 'STORAGE_EMULATOR_HOST'>) {
  if (!env.GCS_BUCKET) {
    throw new Error('Set GCS_BUCKET to the image bucket');
  }
  const storage = new Storage(
    env.STORAGE_EMULATOR_HOST
      ? {
          apiEndpoint: env.STORAGE_EMULATOR_HOST,
          projectId: process.env.GOOGLE_CLOUD_PROJECT ?? env.GCS_BUCKET,
        }
      : {},
  );
  return storage.bucket(env.GCS_BUCKET);
}

export type ImageStore = ReturnType<typeof createImageStore>;

export function imagePath(key: string) {
  return `/media/${key}`;
}

export function saveImage(store: ImageStore, key: string, bytes: Buffer, contentType: string) {
  return store.file(key).save(bytes, {
    contentType,
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
  });
}

const imageTypes = new Map([
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

export function imageRoutes(store: ImageStore | null) {
  return new Hono().get(
    '/media/:kind/:name',
    secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }),
    async (c) => {
      const { kind, name } = c.req.param();
      const extension = /^[a-z0-9-]+\.([a-z]+)$/.exec(name)?.[1];
      const contentType = extension ? imageTypes.get(extension) : undefined;
      if (
        !store ||
        !contentType ||
        !['sample-avatars', 'sample-recipes', 'profiles'].includes(kind)
      ) {
        return await c.notFound();
      }
      const result = await store
        .file(`${kind}/${name}`)
        .download()
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.code === 404) {
            return null;
          }
          throw error;
        });
      if (!result) {
        return await c.notFound();
      }
      return c.body(new Uint8Array(result[0]), 200, {
        'Content-Type': contentType,
        'Cache-Control': kind === 'profiles' ? 'no-cache' : 'public, max-age=3600',
      });
    },
  );
}
