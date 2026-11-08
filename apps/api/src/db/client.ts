import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { relations } from './relations';

export function connectDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return { db: drizzle({ client: pool, relations }), pool };
}

export type Database = ReturnType<typeof connectDatabase>['db'];
