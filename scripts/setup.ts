import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, readFile, writeFile } from 'node:fs/promises';

for (const app of ['api', 'mobile']) {
  const target = new URL(`../apps/${app}/.env`, import.meta.url);
  try {
    await access(target, constants.F_OK);
    console.log(`Kept existing apps/${app}/.env`);
  } catch {
    const example = new URL(`../apps/${app}/.env.example`, import.meta.url);
    if (app === 'api') {
      const content = await readFile(example, 'utf8');
      await writeFile(
        target,
        content.replace(
          'replace-with-at-least-32-random-characters',
          randomBytes(32).toString('hex'),
        ),
        { flag: 'wx', mode: 0o600 },
      );
    } else {
      await copyFile(example, target, constants.COPYFILE_EXCL);
    }
    console.log(`Created apps/${app}/.env`);
  }
}
