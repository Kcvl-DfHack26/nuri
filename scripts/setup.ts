import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function setup(root = fileURLToPath(new URL('../', import.meta.url))) {
  const init = Bun.spawn(['sh', `${root}scripts/worktree-init.sh`, root], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await init.exited) !== 0) {
    throw new Error('Worktree initialization failed');
  }
  for (const app of ['api', 'mobile']) {
    const target = `${root}apps/${app}/.env`;
    const example = await readFile(`${root}apps/${app}/.env.example`, 'utf8');
    const content =
      app === 'api'
        ? example.replace(
            'replace-with-at-least-32-random-characters',
            randomBytes(32).toString('hex'),
          )
        : example;
    try {
      await writeFile(target, content, { flag: 'wx', mode: 0o600 });
      console.log(`Created apps/${app}/.env`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
        throw error;
      }
    }
  }
}

if (import.meta.main) {
  await setup();
}
