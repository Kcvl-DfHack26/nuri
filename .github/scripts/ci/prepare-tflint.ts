import { $ } from 'bun';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { RUNNER_TEMP, GITHUB_PATH, GITHUB_ENV } = Bun.env;
if (!RUNNER_TEMP || !GITHUB_PATH || !GITHUB_ENV) {
  throw new Error('Expected a GitHub Actions runner');
}
const cli = join(RUNNER_TEMP, 'tflint-ci');
const plugins = join(RUNNER_TEMP, 'tflint-ci-plugins');

// 公式 ZIP を公開 SHA-256 と照合し、元の検査と同じバージョンを使う。
await Promise.all([
  install(
    'terraform-linters/tflint',
    'v0.65.0',
    'tflint_linux_amd64.zip',
    'd4c545ed2e29d6338604b586f34f544f380f70f243aa72f7b484713835eaec61',
    cli,
  ),
  install(
    'terraform-linters/tflint-ruleset-google',
    'v0.41.0',
    'tflint-ruleset-google_linux_amd64.zip',
    'efb3910bbc9f0b90bebd76d475ca6cd2cf04a032f6cddc8fa7a334e5011da6d6',
    join(plugins, 'github.com', 'terraform-linters', 'tflint-ruleset-google', '0.41.0'),
  ),
]);
await appendFile(GITHUB_PATH, `${cli}\n`);
await appendFile(GITHUB_ENV, `TFLINT_PLUGIN_DIR=${plugins}\n`);

async function install(repo: string, tag: string, asset: string, sha256: string, path: string) {
  await mkdir(path, { recursive: true });
  await $`gh release download ${tag} --repo ${repo} --pattern ${asset} --dir ${path}`;
  const archive = join(path, asset);
  const actual = new Bun.CryptoHasher('sha256')
    .update(await Bun.file(archive).arrayBuffer())
    .digest('hex');
  if (actual !== sha256) {
    throw new Error(`Unexpected checksum for ${asset}`);
  }
  await $`unzip -q ${archive} -d ${path}`;
}
