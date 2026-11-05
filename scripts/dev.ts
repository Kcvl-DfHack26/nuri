import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { z } from 'zod';

import { apiEnvironment, databaseUrl, serviceName, worktreeSchema } from './dev-config';
import { setup } from './setup';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = `${root}apps/api`;
const mobileRoot = `${root}apps/mobile`;
const command = z
  .enum([
    'all',
    'api',
    'api-server',
    'metro',
    'migrate',
    'migrate-db',
    'services:up',
    'services:down',
    'integration',
    'integration-db',
  ])
  .parse(process.argv[2]);

async function run(
  args: string[],
  cwd = root,
  env: NodeJS.ProcessEnv = { ...process.env, ...settings },
) {
  const child = Bun.spawn(args, {
    cwd,
    env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  let stopping = false;
  const interrupt = () => {
    stopping = true;
    child.kill('SIGINT');
  };
  const terminate = () => {
    stopping = true;
    child.kill('SIGTERM');
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    const code = await child.exited;
    if (stopping) {
      throw new DOMException('Development command stopped', 'AbortError');
    }
    if (code !== 0) {
      throw new Error(`${args[0]} exited with status ${code}`);
    }
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

async function output(args: string[]) {
  const child = Bun.spawn(args, {
    cwd: root,
    env: { ...process.env, ...settings },
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const result = await new Response(child.stdout).text();
  if ((await child.exited) !== 0) {
    throw new Error(`${args[0]} failed`);
  }
  return result.trim();
}

await setup(root);
const settings = worktreeSchema.parse(parseEnv(await readFile(`${root}.env`, 'utf8')));
const container = process.env.STARTER_CONTAINER === '1';
const compose = [
  'docker',
  'compose',
  '--progress',
  'plain',
  '--project-name',
  settings.COMPOSE_PROJECT_NAME,
  '--env-file',
  `${root}.env`,
  '-f',
  `${root}compose.yaml`,
  '-f',
  `${root}compose.host.yaml`,
];

async function localDatabase() {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    return configured;
  }
  if (container || process.env.CI) {
    throw new Error('DATABASE_URL is required in containers and CI');
  }
  await run([...compose, 'up', '-d', '--wait', 'postgres']);
  return databaseUrl(await output([...compose, 'port', 'postgres', '5432']));
}

async function withApiEnv(action: 'api-server' | 'migrate-db' | 'integration-db') {
  await run(['bun', `--env-file=${apiRoot}/.env`, `${root}scripts/dev.ts`, action]);
}

async function migrate(env: NodeJS.ProcessEnv) {
  await run(
    ['node', '--env-file-if-exists=.env', '--import', 'tsx', 'src/db/migrate.ts'],
    apiRoot,
    env,
  );
}

async function main() {
  switch (command) {
    case 'all':
      await run(['bunx', '--no-install', 'turbo', 'run', 'dev']);
      break;
    case 'api':
      if (container) {
        await withApiEnv('api-server');
      } else {
        await run(
          [
            'bunx',
            '--no-install',
            'portless',
            serviceName('api', settings.WORKTREE_ID),
            'bun',
            `--env-file=${apiRoot}/.env`,
            `${root}scripts/dev.ts`,
            'api-server',
          ],
          root,
          { ...process.env, ...settings, PORTLESS_HTTPS: '0', PORTLESS_PORT: '80' },
        );
      }
      break;
    case 'api-server': {
      const env = apiEnvironment(process.env, settings.WORKTREE_ID, await localDatabase());
      await migrate(env);
      await run(
        ['node', '--env-file-if-exists=.env', '--import', 'tsx', '--watch', 'src/index.ts'],
        apiRoot,
        env,
      );
      break;
    }
    case 'metro': {
      const flags = process.argv.slice(3);
      if (flags.some((flag) => flag === '--port' || flag.startsWith('--port='))) {
        throw new Error('Metro ports are managed per worktree; omit --port.');
      }
      const connection = flags.some((flag) =>
        ['--lan', '--localhost', '--tunnel', '--host'].includes(flag),
      )
        ? []
        : ['--lan'];
      const expo = ['bunx', '--no-install', 'expo', 'start', ...connection, ...flags];
      if (container) {
        await run([...expo, '--port', '8081'], mobileRoot);
      } else {
        await run(
          ['bunx', '--no-install', 'portless', serviceName('metro', settings.WORKTREE_ID), ...expo],
          mobileRoot,
          { ...process.env, ...settings, PORTLESS_HTTPS: '0', PORTLESS_PORT: '80' },
        );
      }
      break;
    }
    case 'migrate':
      await withApiEnv('migrate-db');
      break;
    case 'migrate-db':
      await migrate({ ...process.env, DATABASE_URL: await localDatabase() });
      break;
    case 'integration':
      await withApiEnv('integration-db');
      break;
    case 'integration-db': {
      const env = { ...process.env, DATABASE_URL: await localDatabase() };
      await migrate(env);
      await run(['bun', 'test', 'src/auth.integration.test.ts'], apiRoot, env);
      break;
    }
    case 'services:up':
    case 'services:down':
      if (container) {
        throw new Error('Run services commands on the host.');
      }
      await run([
        ...compose,
        ...(command === 'services:up'
          ? ['up', '-d', '--wait', 'postgres']
          : ['down', '--timeout', '5']),
      ]);
      break;
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    process.exitCode = 130;
  } else {
    console.error(error instanceof Error ? error.message : 'Development command failed');
    process.exitCode = 1;
  }
}
