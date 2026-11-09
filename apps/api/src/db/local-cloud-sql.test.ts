import { expect, test } from 'bun:test';

import { localDatabaseUrl } from './local-cloud-sql';

test('accepts existing resources and uses the real endpoint returned by Floci', async () => {
  const requests: { method: string; path: string; body?: unknown }[] = [];
  const floci = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === 'POST') {
        requests.push({ method: request.method, path, body: await request.json() });
        return new Response(null, { status: 409 });
      }
      requests.push({ method: request.method, path });
      return Response.json({ ipAddresses: [{ ipAddress: '172.28.0.4', port: 45432 }] });
    },
  });
  try {
    expect(await localDatabaseUrl(floci.url.origin, 'nuri-isolation-check', true)).toBe(
      'postgresql://nuri:nuri-local@172.28.0.4:45432/nuri',
    );
    const instances = '/v1/projects/nuri-isolation-check/instances';
    expect(requests).toEqual([
      { method: 'POST', path: instances, body: { name: 'nuri', databaseVersion: 'POSTGRES_17' } },
      { method: 'POST', path: `${instances}/nuri/databases`, body: { name: 'nuri' } },
      {
        method: 'POST',
        path: `${instances}/nuri/users`,
        body: { name: 'nuri', password: 'nuri-local' },
      },
      { method: 'GET', path: `${instances}/nuri/connectSettings` },
    ]);
  } finally {
    await floci.stop(true);
  }
});

test('fails if Floci does not provide a data plane endpoint', async () => {
  const floci = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      expect(request.method).toBe('GET');
      return Response.json({ ipAddresses: [] });
    },
  });
  try {
    const error = await localDatabaseUrl(floci.url.origin, 'nuri-test', false).catch(
      (error: unknown) => error,
    );
    expect(error).toHaveProperty('message', expect.stringContaining('ipAddresses'));
  } finally {
    await floci.stop(true);
  }
});

test('fails initialization on Admin API errors other than a duplicate', async () => {
  const floci = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => new Response(null, { status: 503 }),
  });
  try {
    const error = await localDatabaseUrl(floci.url.origin, 'nuri-test', true).catch(
      (error: unknown) => error,
    );
    expect(error).toHaveProperty('message', expect.stringContaining('HTTP 503'));
  } finally {
    await floci.stop(true);
  }
});
