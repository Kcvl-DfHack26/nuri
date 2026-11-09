import { ApiError, Storage } from '@google-cloud/storage';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { getMimeType } from 'hono/utils/mime';
import { z } from 'zod';

import type { Environment } from './env';

import { storageEnvSchema } from './env';

export function createImageStore(env: Pick<Environment, 'GCS_BUCKET' | 'STORAGE_EMULATOR_HOST'>) {
  const bucket = storageEnvSchema.shape.GCS_BUCKET.parse(env.GCS_BUCKET);
  const storage = new Storage(
    env.STORAGE_EMULATOR_HOST
      ? {
          apiEndpoint: env.STORAGE_EMULATOR_HOST,
          projectId: process.env.GOOGLE_CLOUD_PROJECT ?? bucket,
        }
      : {},
  );
  return storage.bucket(bucket);
}

export type ImageStore = ReturnType<typeof createImageStore>;

export function imagePath(key: string) {
  return `/media/${key}`;
}

export function saveImage(store: ImageStore, key: string, bytes: Buffer, contentType = 'auto') {
  return store.file(key).save(bytes, {
    contentType,
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
  });
}

const mediaParams = z.object({
  kind: z.enum(['sample-avatars', 'sample-recipes', 'profiles']),
  name: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/),
});

export function imageRoutes(store: ImageStore | null) {
  return new Hono().get(
    '/media/:kind/:name',
    secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }),
    async (c) => {
      const params = mediaParams.safeParse(c.req.param());
      if (!store || !params.success) {
        return await c.notFound();
      }
      const { kind, name } = params.data;
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
        'Content-Type': getMimeType(name) ?? 'application/octet-stream',
        'Cache-Control': kind === 'profiles' ? 'no-cache' : 'public, max-age=3600',
      });
    },
  );
}
