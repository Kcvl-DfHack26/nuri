import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { apiEnvironment, databaseUrl, projectName, worktreeSchema } from './dev-config';
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

async function settings(root: string) {
  await run(['sh', initScript, root], root);
  return worktreeSchema.parse(parseEnv(await readFile(join(root, '.env'), 'utf8')));
}

describe('worktree configuration', () => {
  test('separates linked and detached worktrees and stays stable after branch changes', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'starter-worktree-')));
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
    const configs = await Promise.all([main, linked, detached].map(settings));
    const linkedConfig = worktreeSchema.parse(configs[1]);
    expect(new Set(configs.map((config) => config.COMPOSE_PROJECT_NAME)).size).toBe(3);
    expect(configs[1]?.WORKTREE_ROOT).toBe(linked);
    expect(configs[1]?.WORKTREE_GIT_COMMON_DIR).toBe(join(main, '.git'));
    await run(['git', 'switch', '-c', 'another-branch'], linked);
    expect(await settings(linked)).toEqual(linkedConfig);
    const alias = join(directory, 'alias');
    await symlink(linked, alias);
    expect(await settings(alias)).toEqual(linkedConfig);
  });

  test('resolves only loopback Docker bindings and rejects malformed ports', () => {
    expect(databaseUrl('127.0.0.1:49182\n')).toBe(
      `postgresql://${projectName}:starter@127.0.0.1:49182/${projectName}`,
    );
    for (const binding of ['0.0.0.0:5432', '127.0.0.1:0', '127.0.0.1:65536', 'not a port']) {
      expect(() => databaseUrl(binding)).toThrow();
    }
  });

  test('concurrent setup creates one secret and preserves app environment values', async () => {
    const root = `${await realpath(await mkdtemp(join(tmpdir(), 'starter-setup-')))}/`;
    temporaryRoots.push(root);
    await run(['git', 'init'], root);
    await mkdir(join(root, 'scripts'));
    await writeFile(join(root, 'scripts/worktree-init.sh'), await readFile(initScript));
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

  test('keeps a configured HTTPS authentication URL and adds worktree origins', () => {
    const env = apiEnvironment(
      {
        PORT: '4123',
        BETTER_AUTH_URL: 'https://api.example.com',
        PORTLESS_URL: 'http://local.example.localhost',
        TRUSTED_ORIGINS: 'https://web.example.com',
        BETTER_AUTH_SECRET: 'retained-secret',
      },
      '012345abcdef',
      'postgresql://ci/db',
    );
    expect(env.BETTER_AUTH_URL).toBe('https://api.example.com');
    expect(env.DATABASE_URL).toBe('postgresql://ci/db');
    expect(env.BETTER_AUTH_SECRET).toBe('retained-secret');
    expect(env.PORT).toBe('4123');
    expect(env.TRUSTED_ORIGINS.split(',')).toContain(
      `http://metro.012345abcdef.${projectName}.localhost`,
    );
    expect(env.TRUSTED_ORIGINS.split(',')).toContain('https://web.example.com');
    expect(
      apiEnvironment(
        { BETTER_AUTH_URL: '', PORTLESS_URL: 'http://api.example.localhost' },
        '012345abcdef',
        'db',
      ).BETTER_AUTH_URL,
    ).toBe('http://api.example.localhost');
  });
});
