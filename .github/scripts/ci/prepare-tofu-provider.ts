import { $ } from 'bun';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const runnerTemp = Bun.env.RUNNER_TEMP;
const githubEnv = Bun.env.GITHUB_ENV;
if (!runnerTemp || !githubEnv) {
  throw new Error('RUNNER_TEMP and GITHUB_ENV are required');
}

const lock = await Bun.file(Bun.argv[2] ?? 'infra/.terraform.lock.hcl').text();
const provider = /provider "registry\.opentofu\.org\/hashicorp\/google" \{([^}]*)\}/.exec(
  lock,
)?.[1];
const version = provider?.match(/^\s+version\s*= "(\d+\.\d+\.\d+)"$/m)?.[1];
if (!provider || !version) {
  throw new Error('The OpenTofu Google provider version is missing from the lockfile');
}

const arch = process.arch === 'x64' ? 'amd64' : process.arch;
const archive = `terraform-provider-google_${version}_${process.platform}_${arch}.zip`;
const mirror = join(runnerTemp, 'tofu-provider-mirror');
const directory = join(mirror, 'registry.opentofu.org', 'hashicorp', 'google');
await mkdir(directory, { recursive: true });
await $`gh release download ${`v${version}`} --repo opentofu/terraform-provider-google --pattern ${archive} --dir ${directory}`;

// 配布ファイルがロックファイルの SHA-256 と一致した場合だけミラーに使う。
const checksum = new Bun.CryptoHasher('sha256')
  .update(await Bun.file(join(directory, archive)).arrayBuffer())
  .digest('hex');
if (!provider.includes(`"zh:${checksum}"`)) {
  throw new Error(`Provider archive does not match the lockfile: ${archive}`);
}

const config = join(runnerTemp, 'tofu-provider-mirror.tfrc');
await Bun.write(
  config,
  `provider_installation {\n  filesystem_mirror {\n    path = ${JSON.stringify(mirror)}\n  }\n}\n`,
);
await appendFile(githubEnv, `TF_CLI_CONFIG_FILE=${config}\n`);
