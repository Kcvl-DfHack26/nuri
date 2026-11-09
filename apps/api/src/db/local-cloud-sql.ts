import { z } from 'zod';

const instance = 'nuri';
const database = 'nuri';
const user = 'nuri';
const password = 'nuri-local';
const connectSettings = z.object({
  ipAddresses: z
    .tuple([z.object({ ipAddress: z.ipv4(), port: z.number().int().min(1).max(65535) })])
    .rest(z.unknown()),
});

async function create(url: string, data: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(120_000),
  });
  await response.body?.cancel();
  if (!response.ok && response.status !== 409) {
    throw new Error(`Cloud SQL Admin POST ${url} failed with HTTP ${response.status}`);
  }
}

export async function localDatabaseUrl(origin: string, project: string, initialize: boolean) {
  const instances = `${origin}/v1/projects/${encodeURIComponent(project)}/instances`;
  const endpoint = `${instances}/${instance}`;
  if (initialize) {
    await create(instances, { name: instance, databaseVersion: 'POSTGRES_17' });
    await create(`${endpoint}/databases`, { name: database });
    await create(`${endpoint}/users`, { name: user, password });
  }

  const response = await fetch(`${endpoint}/connectSettings`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Cloud SQL Admin connectSettings failed with HTTP ${response.status}`);
  }
  const {
    ipAddresses: [{ ipAddress, port }],
  } = connectSettings.parse(await response.json());
  return `postgresql://${user}:${password}@${ipAddress}:${port}/${database}`;
}

if (import.meta.main) {
  const { FLOCI_GCP_URL, GOOGLE_CLOUD_PROJECT } = process.env;
  if (!FLOCI_GCP_URL || !GOOGLE_CLOUD_PROJECT) {
    throw new Error('Run this script in the local Compose environment');
  }
  console.log(
    await localDatabaseUrl(FLOCI_GCP_URL, GOOGLE_CLOUD_PROJECT, process.argv.includes('--init')),
  );
}
