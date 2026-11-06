import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import packageJson from '../package.json' with { type: 'json' };
import { setup } from './setup';

const initScript = fileURLToPath(new URL('./worktree-init.sh', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function run(args: string[], cwd: string) {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const error = await new Response(child.stderr).text();
  if ((await child.exited) !== 0) {
    throw new Error(error);
  }
}

async function identity(root: string) {
  await run(['sh', initScript, root], root);
  const env = parseEnv(await readFile(join(root, '.env'), 'utf8'));
  return { id: env.WORKTREE_ID, project: env.COMPOSE_PROJECT_NAME };
}

describe('Compose setup', () => {
  test('keeps Bun dotenv parsing out of the Compose path settings', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'starter-compose-env-')));
    temporaryRoots.push(root);
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { compose: packageJson.scripts.compose } }),
    );
    await writeFile(
      join(root, '.env'),
      "WORKTREE_ROOT='checkout $value'\nWORKTREE_GIT_COMMON_DIR='git $value'\n",
    );
    await mkdir(join(root, 'node_modules/.bin'), { recursive: true });
    await writeFile(
      join(root, 'node_modules/.bin/portless'),
      '#!/usr/bin/env node\nconsole.log(JSON.stringify([process.env.WORKTREE_ROOT ?? null, process.env.WORKTREE_GIT_COMMON_DIR ?? null, process.env.PORTLESS_PORT, process.env.PORTLESS_HTTPS, ...process.argv.slice(2)]));\n',
      { mode: 0o755 },
    );
    const child = Bun.spawn([process.execPath, 'run', 'compose', 'config'], {
      cwd: root,
      env: {
        ...process.env,
        WORKTREE_ROOT: undefined,
        WORKTREE_GIT_COMMON_DIR: undefined,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect((await new Response(child.stdout).text()).trim()).toBe(
      JSON.stringify([null, null, '443', '1', 'compose', 'config']),
    );
    expect(await child.exited).toBe(0);
  });

  test('separates checkout identities and keeps them stable after branch changes and symlinks', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'starter-compose-')));
    temporaryRoots.push(directory);
    const main = join(directory, 'main checkout');
    await run(['git', 'init', main], directory);
    await run(
      [
        'git',
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '--allow-empty',
        '-m',
        'initial',
      ],
      main,
    );
    const linked = join(directory, "linked ' checkout $value");
    const detached = join(directory, 'detached');
    await run(['git', 'worktree', 'add', '-b', 'feature', linked], main);
    await run(['git', 'worktree', 'add', '--detach', detached], main);
    const identities = await Promise.all([main, linked, detached].map(identity));
    expect(new Set(identities.map((value) => value.project)).size).toBe(3);
    const before = await identity(linked);
    expect(before.id).toMatch(/^[a-f0-9]{12}$/);
    await run(['git', 'switch', '-c', 'another-branch'], linked);
    expect(await identity(linked)).toEqual(before);
    const alias = join(directory, 'alias');
    await symlink(linked, alias);
    expect(await identity(alias)).toEqual(before);
  });

  test('concurrent setup creates one secret and preserves configured application values', async () => {
    const root = `${await realpath(await mkdtemp(join(tmpdir(), 'starter-env-')))}/`;
    temporaryRoots.push(root);
    for (const app of ['api', 'mobile']) {
      await mkdir(join(root, 'apps', app), { recursive: true });
      await writeFile(
        join(root, 'apps', app, '.env.example'),
        app === 'api'
          ? 'BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\n'
          : 'EXPO_PUBLIC_API_URL=\n',
      );
    }
    await Promise.all([setup(root), setup(root)]);
    const api = join(root, 'apps/api/.env');
    const initial = await readFile(api, 'utf8');
    expect(parseEnv(initial).BETTER_AUTH_SECRET).toHaveLength(64);
    await writeFile(api, `${initial}BETTER_AUTH_URL=https://api.example.com\n`);
    await setup(root);
    expect(await readFile(api, 'utf8')).toBe(`${initial}BETTER_AUTH_URL=https://api.example.com\n`);
  });
});
