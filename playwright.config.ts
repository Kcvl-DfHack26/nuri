import { defineConfig } from '@playwright/test';

const port = 49116;
const origin = `http://127.0.0.1:${port}`;
const database =
  process.env.NURI_E2E_DATABASE_URL ?? 'postgresql://nuri_e2e:nuri_e2e@127.0.0.1:55432/nuri_e2e';

if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(database).hostname)) {
  throw new Error('NURI_E2E_DATABASE_URL must point to a disposable local PostgreSQL database');
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
    {
      name: 'webkit',
      testIgnore: '**/camera.spec.ts',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: {
    cwd: './apps/api',
    command:
      'NODE_ENV=production bun run --cwd ../mobile expo export --platform web --output-dir .expo/e2e-web && ' +
      'bun run db:migrate && bun run db:seed && exec node --import tsx src/index.ts',
    url: `${origin}/ready`,
    timeout: 180_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
      DATABASE_URL: database,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: 'local-e2e-only-not-for-real-deployments',
      EXPO_WEB_ROOT: '../mobile/.expo/e2e-web',
      EXPO_PUBLIC_API_URL: '/',
      EXPO_NO_TELEMETRY: '1',
      AUTH_EMULATE: 'true',
      GOOGLE_EMULATOR_URL: 'http://127.0.0.1:4002',
      APPLE_EMULATOR_URL: 'http://127.0.0.1:4004',
      RESEND_API_URL: 'http://127.0.0.1:4005',
    },
  },
});
