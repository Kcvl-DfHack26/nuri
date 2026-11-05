import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://starter:starter@localhost:5432/starter',
  },
});
