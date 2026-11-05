import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export function connectDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return { db: drizzle({ client: pool }), pool };
}
