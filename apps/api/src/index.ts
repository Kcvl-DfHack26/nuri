import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createAuth } from './auth';
import { connectDatabase } from './db/client';
import { readEnv } from './env';

const env = readEnv();
const { db, pool } = connectDatabase(env.DATABASE_URL);
const auth = createAuth(db, env);
const app = createApp(
  auth,
  async () => {
    await pool.query('SELECT 1');
  },
  env.TRUSTED_ORIGINS.split(','),
);
const server = serve({ fetch: app.fetch, hostname: '0.0.0.0', port: env.PORT }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}`);
});

let stopping = false;
function shutdown() {
  if (stopping) {
    return;
  }
  stopping = true;
  server.close(() => {
    void pool.end().catch(() => {
      console.error('Failed to close the database pool');
      process.exitCode = 1;
    });
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
