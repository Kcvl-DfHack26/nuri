import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

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

  // 共有プロジェクトでは、state が指すサービスを操作前に照合する。
  const state: unknown = await response.json();
  const resources: unknown = isRecord(state) ? state.resources : null;
  if (!Array.isArray(resources)) {
    throw new Error('Invalid OpenTofu preview state');
  }
  if (resources.length === 0) {
    return false;
  }

  const entries: unknown[] = resources;
  const [resource] = entries;
  const service = `nuri-preview-pr-${pr}`;
  const region = 'asia-northeast1';
  if (
    resources.length !== 1 ||
    !isRecord(resource) ||
    resource.module !== undefined ||
    resource.mode !== 'managed' ||
    resource.type !== 'google_cloud_run_v2_service' ||
    resource.name !== 'preview' ||
    !Array.isArray(resource.instances) ||
    resource.instances.length !== 1
  ) {
    throw new Error('OpenTofu preview state contains an unexpected resource');
  }

  const instances: unknown[] = resource.instances;
  const [instance] = instances;
  const attributes = isRecord(instance) ? instance.attributes : null;
  if (
    !isRecord(attributes) ||
    attributes.id !== `projects/${project}/locations/${region}/services/${service}` ||
    attributes.project !== project ||
    attributes.location !== region ||
    attributes.name !== service
  ) {
    throw new Error('OpenTofu preview state points to an unexpected Cloud Run service');
  }
  return true;
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
  const tagKey = Bun.env.PREVIEW_RUN_TAG_KEY;
  const tagValue = Bun.env.PREVIEW_RUN_TAG_VALUE;
  if (!tagKey || !tagValue) {
    throw new Error('The preview Cloud Run tag is required');
  }
  const variables = [
    `-var=project_id=${project}`,
    `-var=pr_number=${pr}`,
    `-var=tag_key=${tagKey}`,
    `-var=tag_value=${tagValue}`,
  ];
  try {
    // 同じ作業ツリーで複数PRを処理しても、状態やロックを混ぜない。
    await $`tofu -chdir=${directory} init -reconfigure -input=false -no-color -lockfile=readonly \
      -backend-config=bucket=${bucketName(project)} -backend-config=prefix=pr-${pr}`.env(env);
    await hasPreviewService(project, pr);
    let operationOptions = [...options, ...variables, '-auto-approve'];
    if (operation === 'apply') {
      const plan = join(scratch, 'preview.tfplan');
      const planOptions = [...options, ...variables, `-out=${plan}`];
      await $`tofu -chdir=${directory} plan ${planOptions}`.env(env);
      operationOptions = [...options, plan];
    }
    if (hooks.beforeAttempt && !(await hooks.beforeAttempt())) {
      return null;
    }
    const result = await executeOperation({
      directory,
      operation,
      options: operationOptions,
      env,
      events: join(scratch, 'events.jsonl'),
    });
    await hooks.onAttempt(result);
    return result.exitCode;
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}
