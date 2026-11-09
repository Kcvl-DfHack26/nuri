import { ApiError } from '@google-cloud/storage';

import { createImageStore } from '../apps/api/src/modules/images';

const { GCS_BUCKET, STORAGE_EMULATOR_HOST } = process.env;
if (!STORAGE_EMULATOR_HOST) {
  throw new Error('Set STORAGE_EMULATOR_HOST to initialize a local bucket');
}

const bucket = createImageStore({ GCS_BUCKET, STORAGE_EMULATOR_HOST });
try {
  await bucket.create();
} catch (error) {
  if (!(error instanceof ApiError && error.code === 409)) {
    throw error;
  }
}
