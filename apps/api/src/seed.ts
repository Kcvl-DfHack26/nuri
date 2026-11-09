import { connectDatabase } from './db/client';
import { readEnv } from './platform/env';
import { createImageStore } from './platform/images';
import { seedSampleData } from './sample-data';

const env = readEnv();
if (env.NODE_ENV !== 'development' || !env.AUTH_EMULATE) {
  throw new Error('Sample data is only available in local emulation');
}
const images = createImageStore(env);
const { db, pool } = connectDatabase(env.DATABASE_URL);
try {
  const counts = await seedSampleData(db, images);
  console.log(`Local sample data ready: ${counts.users} users and ${counts.recipes} recipes`);
} finally {
  await pool.end();
}
