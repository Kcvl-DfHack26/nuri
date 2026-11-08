import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { connectDatabase } from './client';
import { syncRecipeTemplates } from './recipe-templates';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required');
}
const { db, pool } = connectDatabase(url);
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  await syncRecipeTemplates(db);
} finally {
  await pool.end();
}
