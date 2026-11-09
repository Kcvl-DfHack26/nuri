import { z } from 'zod';

const appName = 'nuri';
const password = 'nuri-local';
const environment = z.object({
  FLOCI_GCP_URL: z.url({ protocol: /^https?$/ }),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
});
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

export async function localDatabaseUrl(env: NodeJS.ProcessEnv, initialize: boolean) {
  const { FLOCI_GCP_URL: origin, GOOGLE_CLOUD_PROJECT: project } = environment.parse(env);
  const instances = `${origin}/v1/projects/${encodeURIComponent(project)}/instances`;
  const endpoint = `${instances}/${appName}`;
  if (initialize) {
    await create(instances, { name: appName, databaseVersion: 'POSTGRES_17' });
    await create(`${endpoint}/databases`, { name: appName });
    await create(`${endpoint}/users`, { name: appName, password });
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
  return `postgresql://${appName}:${password}@${ipAddress}:${port}/${appName}`;
}

if (import.meta.main) {
  console.log(await localDatabaseUrl(process.env, process.argv[2] === '--init'));
}
