import { $ } from 'bun';
import { appendFile } from 'node:fs/promises';

function requiredEnv(name: string) {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const project = requiredEnv('PROJECT_ID');
const region = requiredEnv('REGION');
const service = requiredEnv('SERVICE');
const repository = requiredEnv('REPOSITORY');
const migrationJob = requiredEnv('MIGRATION_JOB');
const targetSha = requiredEnv('TARGET_SHA');
const cloudRunTarget = [`--project=${project}`, `--region=${region}`];
const digestPattern = /^sha256:[a-f0-9]{64}$/;

async function requireCurrentMain() {
  const route = `repos/${requiredEnv('GITHUB_REPOSITORY')}/git/ref/heads/main`;
  const mainSha = (await $`gh api ${route} --jq .object.sha`.text()).trim();
  if (mainSha !== targetSha) {
    throw new Error('This SHA is no longer the tip of main');
  }
}

async function check() {
  await requireCurrentMain();
  const repo = requiredEnv('GITHUB_REPOSITORY');
  const route = `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${targetSha}&status=success`;
  const filter = '[.workflow_runs[] | select(.event == "push")] | length';
  const passed = Number((await $`gh api ${route} --jq ${filter}`.text()).trim());
  if (!Number.isInteger(passed) || passed <= 0) {
    throw new Error('This SHA has not passed the main CI workflow');
  }
}

async function writeOutput(name: string, value: string) {
  await appendFile(requiredEnv('GITHUB_OUTPUT'), `${name}=${value}\n`);
}

async function describeService() {
  const live =
    await $`gcloud run services describe ${service} ${cloudRunTarget} --format=json`.quiet();
  return live.stdout;
}

async function readServiceField(live: Buffer, filter: string) {
  return (await $`jq -r ${filter} < ${live}`.text()).trim();
}

async function checkWeb(origin: string, curlOptions: string[]) {
  await $`curl --fail --silent --show-error ${curlOptions} ${origin}/ready`;
  await $`bun .github/scripts/check-expo-web.ts ${origin}`;
}

async function alreadyServing(uri: string) {
  const live = await describeService();
  const revision = await readServiceField(
    live,
    '.status.traffic[] | select(.percent == 100) | .revisionName',
  );
  if (!revision) {
    return false;
  }
  const deployed = (
    await $`gcloud run revisions describe ${revision} ${cloudRunTarget} --format='value(spec.containers[0].image)'`.text()
  ).trim();
  if (deployed !== uri) {
    return false;
  }
  const origin = await readServiceField(live, '.status.url');
  try {
    await checkWeb(origin, ['--max-time', '15']);
    return true;
  } catch {
    console.log('The current staging revision failed its readiness or Web check.');
    return false;
  }
}

async function resolveImage() {
  const imageInputs = [
    'apps/api',
    'apps/mobile',
    'apps/emulate/package.json',
    'packages/shared',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'tsconfig.json',
    '.dockerignore',
  ];
  const tree = await $`git ls-tree -r ${targetSha} -- ${imageInputs}`.quiet();
  const key = new Bun.CryptoHasher('sha256').update(tree.stdout).digest('hex');
  const host = `${region}-docker.pkg.dev`;
  const path = `${host}/${project}/${repository}/api`;
  const image = `${path}:tree-${key}`;
  const existing =
    await $`gcloud artifacts docker images describe ${image} --format='value(image_summary.digest)'`
      .quiet()
      .nothrow();
  let digest = existing.stdout.toString().trim();
  if (existing.exitCode !== 0 || !digestPattern.test(digest)) {
    await $`gcloud auth configure-docker ${host} --quiet`;
    await $`docker build -f apps/api/Dockerfile -t ${image} .`;
    await $`docker push ${image}`;
    digest = (
      await $`gcloud artifacts docker images describe ${image} --format='value(image_summary.digest)'`.text()
    ).trim();
  }
  if (!digestPattern.test(digest)) {
    throw new Error('Artifact Registry did not return a valid image digest');
  }
  const uri = `${path}@${digest}`;
  await writeOutput('uri', uri);
  if (Bun.env.GITHUB_EVENT_NAME === 'workflow_run' && (await alreadyServing(uri))) {
    console.log('Staging already serves the checked image.');
    await writeOutput('skip', 'true');
  }
}

async function migrate() {
  const image = requiredEnv('IMAGE_URI');
  await $`gcloud run jobs update ${migrationJob} ${cloudRunTarget} --image=${image} --quiet`;
  await $`gcloud run jobs execute ${migrationJob} ${cloudRunTarget} --wait --quiet`;
}

async function deployCandidate() {
  const image = requiredEnv('IMAGE_URI');
  await $`gcloud run deploy ${service} ${cloudRunTarget} --image=${image} --no-traffic --quiet`;
  // OpenTofu 適用後に古いリビジョンを指す場合があるため、イメージのダイジェストで特定する（#92）。
  const revision = (
    await $`gcloud run revisions list --service=${service} ${cloudRunTarget} --filter=spec.containers.image=${image} --sort-by=~metadata.creationTimestamp --limit=1 --format='value(metadata.name)'`.text()
  ).trim();
  if (!revision) {
    throw new Error(`No revision runs ${image}`);
  }
  await $`gcloud run services update-traffic ${service} ${cloudRunTarget} --update-tags=candidate=${revision} --quiet`;
  const origin = await readServiceField(
    await describeService(),
    '.status.traffic[] | select(.tag == "candidate") | .url',
  );
  await checkWeb(origin, ['--retry', '6', '--retry-all-errors', '--retry-delay', '5']);
  await writeOutput('revision', revision);
}

async function promote() {
  const revision = requiredEnv('REVISION');
  await requireCurrentMain();
  await $`gcloud run services update-traffic ${service} ${cloudRunTarget} --to-revisions=${revision}=100 --remove-tags=candidate --quiet`;
  const origin = await readServiceField(await describeService(), '.status.url');
  await checkWeb(origin, ['--retry', '3', '--retry-all-errors']);
}

switch (Bun.argv[2]) {
  case 'check':
    await check();
    break;
  case 'image':
    await resolveImage();
    break;
  case 'migrate':
    await migrate();
    break;
  case 'candidate':
    await deployCandidate();
    break;
  case 'promote':
    await promote();
    break;
  default:
    throw new Error('Specify check, image, migrate, candidate, or promote');
}
