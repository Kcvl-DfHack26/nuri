import { defineConfig } from '@playwright/test';
import { z } from 'zod';

const port = 49116;
const origin = `http://127.0.0.1:${port}`;
// E2E writes sample data to disposable services.
const loopback = /^(?:127\.0\.0\.1|localhost|\[::1\])$/;
const { NURI_E2E_DATABASE_URL: database, NURI_E2E_STORAGE_EMULATOR_HOST: storage } = z
  .object({
    NURI_E2E_DATABASE_URL: z
      .url({ protocol: /^postgres(?:ql)?$/, hostname: loopback })
      .default('postgresql://nuri_e2e:nuri_e2e@127.0.0.1:55432/nuri_e2e'),
    NURI_E2E_STORAGE_EMULATOR_HOST: z
      .url({ protocol: /^https?$/, hostname: loopback })
      .default('http://127.0.0.1:4588'),
  })
  .parse(process.env);

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
