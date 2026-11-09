import { expect, test } from 'bun:test';

import { localDatabaseUrl } from './local-cloud-sql';

test('accepts existing resources and uses the endpoint returned by Floci', async () => {
  const requests: string[] = [];
  const floci = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (request.method === 'POST') {
        return new Response(null, { status: 409 });
      }
      return Response.json({ ipAddresses: [{ ipAddress: '172.28.0.4', port: 45432 }] });
    },
  });
  try {
    expect(
      await localDatabaseUrl(
        { FLOCI_GCP_URL: floci.url.origin, GOOGLE_CLOUD_PROJECT: 'nuri-isolation-check' },
        true,
      ),
    ).toBe('postgresql://nuri:nuri-local@172.28.0.4:45432/nuri');
    const instances = '/v1/projects/nuri-isolation-check/instances';
    expect(requests).toEqual([
      `POST ${instances}`,
      `POST ${instances}/nuri/databases`,
      `POST ${instances}/nuri/users`,
      `GET ${instances}/nuri/connectSettings`,
    ]);
  } finally {
    await floci.stop(true);
  }
});
