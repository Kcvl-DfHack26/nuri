import { defineConfig } from '@playwright/test';

const port = 49116;
const origin = `http://127.0.0.1:${port}`;
const database =
  process.env.NURI_E2E_DATABASE_URL ?? 'postgresql://nuri_e2e:nuri_e2e@127.0.0.1:55432/nuri_e2e';

const storage = process.env.NURI_E2E_STORAGE_EMULATOR_HOST ?? 'http://127.0.0.1:4588';

for (const url of [database, storage]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('E2E PostgreSQL and Floci must point to disposable local services');
  }
}

export default defineConfig({
  testDir: './e2e',
  outputDir: '.artifacts/playwright',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
        launchOptions: { args: ['--use-fake-device-for-media-stream'] },
      },
    },
  ],
  webServer: {
    cwd: './apps/api',
    command:
      'NODE_ENV=production bun run --bun --cwd ../mobile expo export --platform web --output-dir .expo/e2e-web && ' +
      'bun run storage:init && bun src/db/migrate.ts && bun src/seed.ts && exec bun src/index.ts',
    url: `${origin}/ready`,
    timeout: 180_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
      DATABASE_URL: database,
      GCS_BUCKET: 'nuri-e2e',
      STORAGE_EMULATOR_HOST: storage,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: 'local-e2e-only-not-for-real-deployments',
      EXPO_WEB_ROOT: '../mobile/.expo/e2e-web',
      EXPO_PUBLIC_API_URL: '/',
      EXPO_NO_TELEMETRY: '1',
      AUTH_EMULATE: 'true',
      GOOGLE_EMULATOR_URL: 'http://127.0.0.1:4002',
      RESEND_API_URL: 'http://127.0.0.1:4005',
    },
  },
});
