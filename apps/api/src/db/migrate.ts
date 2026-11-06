import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { connectDatabase } from './client';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required');
}
const { db, pool } = connectDatabase(url);
try {
  await migrate(db, { migrationsFolder: './drizzle' });
} finally {
  await pool.end();
}
