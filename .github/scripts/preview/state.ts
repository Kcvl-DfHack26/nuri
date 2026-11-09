import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { readOperationDetails } from './operation-details';
import { executeOperation } from './run-operation';

const directory = 'infra/preview-pr';
const options = ['-input=false', '-no-color', '-lock-timeout=5m'];
const statePattern = /^pr-([1-9]\d{0,8})\/default\.tfstate$/;

function bucketName(project: string) {
  return `${project}-nuri-preview-state`;
}

function recordStateNames(items: unknown, pullRequests: Set<string>) {
  if (items === undefined) {
    return;
  }
  if (!Array.isArray(items)) {
    throw new Error('Invalid preview state objects');
  }
  const entries: unknown[] = items;
  for (const item of entries) {
    if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
      const match = statePattern.exec(item.name);
      if (match?.[1]) {
        pullRequests.add(match[1]);
      }
    }
  }
}

async function storageToken() {
  const token = (await $`gcloud auth print-access-token`.text()).trim();
  if (!token) {
    throw new Error('Could not read the preview access token');
  }
  return token;
}

export async function listPreviewStates(project: string, pr?: string) {
  const token = await storageToken();
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${bucketName(project)}/o`);
  url.searchParams.set('prefix', pr ? `pr-${pr}/default.tfstate` : 'pr-');
  url.searchParams.set('fields', 'items(name),nextPageToken');

  const pullRequests = new Set<string>();
  for (;;) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Could not list preview states: HTTP ${response.status}`);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid preview state listing');
    }
    recordStateNames('items' in result ? result.items : undefined, pullRequests);
    const page = 'nextPageToken' in result ? result.nextPageToken : undefined;
    if (typeof page !== 'string' || !page) {
      return pullRequests;
    }
    url.searchParams.set('pageToken', page);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function hasPreviewService(project: string, pr: string) {
  const object = encodeURIComponent(`pr-${pr}/default.tfstate`);
  const url = `https://storage.googleapis.com/storage/v1/b/${bucketName(project)}/o/${object}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await storageToken()}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Could not read preview state: HTTP ${response.status}`);
  }

  return validatePreviewState(await response.json(), project, pr);
}

export function previewImageBucket(project: string, pr: string) {
  return `${project}-nuri-preview-pr-${pr}-media`;
}

// 照合済みのリソースだけを操作する。旧 state や途中まで作成・削除された state も再実行できる。
export function validatePreviewState(state: unknown, project: string, pr: string) {
  const resources: unknown = isRecord(state) ? state.resources : null;
  if (!Array.isArray(resources)) {
    throw new Error('Invalid OpenTofu preview state');
  }

  const region = 'asia-northeast1';
  const service = `nuri-preview-pr-${pr}`;
  const bucket = previewImageBucket(project, pr);
  const member = `serviceAccount:nuri-preview-runtime@${project}.iam.gserviceaccount.com`;
  const role = 'roles/storage.objectUser';
  const expected = new Map<string, Record<string, string>>([
    [
      'google_cloud_run_v2_service.preview',
      {
        id: `projects/${project}/locations/${region}/services/${service}`,
        project,
        location: region,
        name: service,
      },
    ],
    [
      'google_storage_bucket.images',
      { id: bucket, project, location: 'ASIA-NORTHEAST1', name: bucket },
    ],
    [
      'google_storage_bucket_iam_member.runtime_images',
      { id: `b/${bucket}/${role}/${member}`, bucket: `b/${bucket}`, role, member },
    ],
  ]);

  const entries: unknown[] = resources;
  let hasService = false;
  for (const entry of entries) {
    if (
      !isRecord(entry) ||
      entry.module !== undefined ||
      entry.mode !== 'managed' ||
      typeof entry.type !== 'string' ||
      typeof entry.name !== 'string' ||
      !Array.isArray(entry.instances) ||
      entry.instances.length !== 1
    ) {
      throw new Error('OpenTofu preview state contains an unexpected resource');
    }

    const address = `${entry.type}.${entry.name}`;
    const fields = expected.get(address);
    const instances: unknown[] = entry.instances;
    const [instance] = instances;
    const attributes = isRecord(instance) ? instance.attributes : null;
    if (
      !fields ||
      !isRecord(instance) ||
      instance.index_key !== undefined ||
      instance.deposed !== undefined ||
      !isRecord(attributes) ||
      Object.entries(fields).some(([key, value]) => attributes[key] !== value)
    ) {
      throw new Error(`OpenTofu preview state points to an unexpected resource at ${address}`);
    }

    expected.delete(address);
    hasService ||= address === 'google_cloud_run_v2_service.preview';
  }
  return hasService;
}

export async function removePreviewState(project: string, pr: string) {
  const object = `gs://${bucketName(project)}/pr-${pr}/default.tfstate`;
  await $`gcloud storage rm ${object} --all-versions --quiet`;
}

export async function runPreviewTofu(
  project: string,
  pr: string,
  operation: 'apply' | 'destroy',
  hooks: {
    beforeAttempt?: () => Promise<boolean>;
    onAttempt: (result: Awaited<ReturnType<typeof executeOperation>>) => void | Promise<void>;
  },
) {
  const runnerTemp = Bun.env.RUNNER_TEMP;
  if (!runnerTemp) {
    throw new Error('RUNNER_TEMP is required');
  }
  const scratch = await mkdtemp(join(runnerTemp, `nuri-preview-pr-${pr}-`));
  const env = {
    ...Bun.env,
    TF_IN_AUTOMATION: 'true',
    TF_DATA_DIR: join(scratch, 'tofu'),
    TF_WORKSPACE: 'default',
  };
  const variables = [`-var=project_id=${project}`, `-var=pr_number=${pr}`];
  try {
    // 同じ作業ツリーで複数PRを処理しても、状態やロックを混ぜない。
    await $`tofu -chdir=${directory} init -reconfigure -input=false -no-color -lockfile=readonly \
      -backend-config=bucket=${bucketName(project)} -backend-config=prefix=pr-${pr}`.env(env);
    await hasPreviewService(project, pr);
    let plan: string | undefined;
    if (operation === 'apply') {
      plan = join(scratch, 'preview.tfplan');
      const planOptions = [...options, ...variables, `-out=${plan}`];
      await $`tofu -chdir=${directory} plan ${planOptions}`.env(env);
    }
    const details = await readOperationDetails(directory, env, plan);
    if (hooks.beforeAttempt && !(await hooks.beforeAttempt())) {
      return null;
    }
    const result = await executeOperation({
      directory,
      operation,
      options: plan ? [...options, plan] : [...options, ...variables, '-auto-approve'],
      env,
      events: join(scratch, 'events.jsonl'),
      details,
    });
    await hooks.onAttempt(result);
    return result.exitCode;
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}
