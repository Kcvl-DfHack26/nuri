import { $ } from 'bun';

const origin = 'http://localhost:8080';
const environment = [
  '-e',
  'DATABASE_URL=postgresql://unused:unused@localhost:5432/unused',
  '-e',
  'BETTER_AUTH_SECRET=ci-only-secret-not-for-real-deployments',
  '-e',
  'BETTER_AUTH_URL=https://example.com',
];
const container = (
  await $`docker run -d -p 8080:8080 ${environment} expo-hono-opentofu-starter-api`.text()
).trim();

try {
  await $`curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 1 --max-time 5 ${origin}/health`;
  await $`bash scripts/check-expo-web.sh ${origin}`;
  const photos = [...new Bun.Glob('*.jpg').scanSync('apps/api/assets/product-kinds')];
  if (photos.length === 0) {
    throw new Error('No product kind photos found in the source tree');
  }
  for (const photo of photos) {
    const response = await fetch(`${origin}/product-kinds/${photo}`, {
      signal: AbortSignal.timeout(5000),
    });
    const contentType = response.headers.get('content-type');
    await response.body?.cancel();
    if (response.status !== 200 || contentType !== 'image/jpeg') {
      throw new Error(`Expected a JPEG for ${photo}, got HTTP ${response.status} (${contentType})`);
    }
  }
} catch (error) {
  await $`docker logs ${container}`.nothrow();
  throw error;
} finally {
  await $`docker rm --force ${container}`.quiet().nothrow();
}
