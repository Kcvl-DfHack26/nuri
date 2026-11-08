import { connectDatabase } from './db/client';
import { seedSampleData } from './db/sample-data';
import { readEnv } from './platform/env';

const env = readEnv();
if (env.NODE_ENV !== 'development' || !env.AUTH_EMULATE) {
  throw new Error('Sample data is only available in local emulation');
}
const { db, pool } = connectDatabase(env.DATABASE_URL);
try {
  const counts = await seedSampleData(db);
  console.log(`Local sample data ready: ${counts.users} users and ${counts.recipes} recipes`);
} finally {
  await pool.end();
}
