import { ApiError } from '@google-cloud/storage';

import { storageEnvSchema } from './platform/env';
import { createImageStore } from './platform/images';

const bucket = createImageStore(storageEnvSchema.parse(process.env));
try {
  await bucket.create();
} catch (error) {
  if (!(error instanceof ApiError && error.code === 409)) {
    throw error;
  }
}
