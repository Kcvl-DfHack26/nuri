import { $ } from 'bun';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const runnerTemp = Bun.env.RUNNER_TEMP;
const githubEnv = Bun.env.GITHUB_ENV;
const githubPath = Bun.env.GITHUB_PATH;
if (!runnerTemp || !githubEnv || !githubPath) {
  throw new Error('RUNNER_TEMP, GITHUB_ENV and GITHUB_PATH are required');
}
if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('This installer requires a Linux x64 Actions runner');
}

const versionTag = '1.13.8';
const tofuArchive = `tofu_${versionTag}_linux_amd64.zip`;
const tofuDirectory = join(runnerTemp, 'nuri-opentofu');
const tofuChecksum = 'aa4382a5eefcf026309d07398ea803f97b9218a17d940999a938be22bfe9d73f';

async function sha256(path: string) {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex');
}

// 公式リリースの配布ファイルを API から取得し、公開 SHA-256 と照合してから使う。
await mkdir(tofuDirectory, { recursive: true });
await $`gh release download ${`v${versionTag}`} --repo opentofu/opentofu --pattern ${tofuArchive} --dir ${tofuDirectory}`;
const tofuZip = join(tofuDirectory, tofuArchive);
if ((await sha256(tofuZip)) !== tofuChecksum) {
  throw new Error(`OpenTofu archive does not match its published checksum: ${tofuArchive}`);
}
await $`unzip -q ${tofuZip} tofu -d ${tofuDirectory}`;
await appendFile(githubPath, `${tofuDirectory}\n`);

const lock = await Bun.file(Bun.argv[2] ?? 'infra/.terraform.lock.hcl').text();
const provider = /provider "registry\.opentofu\.org\/hashicorp\/google" \{([^}]*)\}/.exec(
  lock,
)?.[1];
const version = provider?.match(/^\s+version\s*= "(\d+\.\d+\.\d+)"$/m)?.[1];
if (!provider || !version) {
  throw new Error('The OpenTofu Google provider version is missing from the lockfile');
}

const archive = `terraform-provider-google_${version}_linux_amd64.zip`;
const mirror = join(runnerTemp, 'tofu-provider-mirror');
const directory = join(mirror, 'registry.opentofu.org', 'hashicorp', 'google');
await mkdir(directory, { recursive: true });
await $`gh release download ${`v${version}`} --repo opentofu/terraform-provider-google --pattern ${archive} --dir ${directory}`;

// 配布ファイルがロックファイルの SHA-256 と一致した場合だけミラーに使う。
const checksum = await sha256(join(directory, archive));
if (!provider.includes(`"zh:${checksum}"`)) {
  throw new Error(`Provider archive does not match the lockfile: ${archive}`);
}

const config = join(runnerTemp, 'tofu-provider-mirror.tfrc');
await Bun.write(
  config,
  `provider_installation {\n  filesystem_mirror {\n    path = ${JSON.stringify(mirror)}\n  }\n}\n`,
);
await appendFile(githubEnv, `TF_CLI_CONFIG_FILE=${config}\n`);
