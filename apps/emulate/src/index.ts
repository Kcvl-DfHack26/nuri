import { createEmulator } from 'emulate';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Emulate cannot run in production');
}
const service = process.env.EMULATE_SERVICE;
if (service !== 'google' && service !== 'resend') {
  throw new Error('Set EMULATE_SERVICE to google or resend');
}
const configuredApi = process.env.BETTER_AUTH_URL?.trim();
const apiOrigin =
  (configuredApi === '' ? undefined : configuredApi) ??
  process.env.DEV_API_ORIGIN ??
  'http://localhost:8080';
const baseUrl = process.env.EMULATE_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? '4002'}`;
const emulator = await createEmulator({
  service,
  port: Number(process.env.PORT ?? '4002'),
  hostname: process.env.EMULATE_HOST ?? '127.0.0.1',
  baseUrl,
  seed: {
    [service]: {
      ...(service === 'resend' ? { domains: [{ name: 'example.com' }] } : {}),
      users: [
        {
          email: 'hanako@example.com',
          name: 'はなこ',
          email_verified: true,
          given_name: 'はなこ',
          family_name: '山田',
        },
        { email: 'taro@example.com', name: 'たろう', email_verified: true },
      ],
      oauth_clients: [
        {
          client_id: 'starter-local',
          client_secret: 'starter-local-secret',
          name: 'SNSサンプル',
          redirect_uris: [`${apiOrigin}/api/auth/callback/emulate-${service}`],
        },
      ],
    },
  },
});
console.log(`${service}: ${baseUrl}`);
async function shutdown() {
  await emulator.close();
}
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
