import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

import { operationDetails } from './operation-details';
import { executeOperation } from './run-operation';

const directory = 'infra/preview-pr';
const options = ['-input=false', '-no-color', '-lock-timeout=5m'];
const statePattern = /^pr-([1-9]\d{0,8})\/default\.tfstate$/;

function bucketName(project: string) {
  return `${project}-nuri-preview-state`;
}

const stateObjects = z.array(z.object({ name: z.string() }));

export async function listPreviewStates(project: string, pr?: string) {
  const uri = `gs://${bucketName(project)}/${pr ? `pr-${pr}/*` : '**'}`;
  const objects = stateObjects.parse(
    await $`gcloud storage objects list ${uri} --format='json(name)'`.json(),
  );
  return new Set(
    objects.flatMap(({ name }) => {
      const pr = statePattern.exec(name)?.[1];
      return pr ? [pr] : [];
    }),
  );
}

const changes = z
  .array(
    z.object({
      address: z.string(),
      mode: z.literal('managed'),
      previous_address: z.never().optional(),
      deposed: z.never().optional(),
      change: z.object({ before: z.record(z.string(), z.unknown()).nullable() }),
    }),
  )
  .default([]);

const previewPlan = z.object({
  format_version: z.string().regex(/^1\.\d+$/),
  errored: z.literal(false),
  resource_changes: changes,
  resource_drift: changes,
  planned_values: z
    .object({
      outputs: z
        .object({
          image_bucket: z.object({ sensitive: z.literal(false), value: z.string() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

// IAM covers the preview namespace. Verify exact PR ownership before applying the saved plan.
export function validatePreviewPlan(document: unknown, project: string, pr: string) {
  const plan = previewPlan.parse(document);
  const region = 'asia-northeast1';
  const service = `nuri-preview-pr-${pr}`;
  const bucket = `${project}-${service}-media`;
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

  // Drift includes resources that refresh removed from the planned changes.
  for (const changes of [plan.resource_changes, plan.resource_drift]) {
    const addresses = new Set<string>();
    for (const {
      address,
      change: { before },
    } of changes) {
      const fields = expected.get(address);
      if (
        !fields ||
        addresses.has(address) ||
        (before && Object.entries(fields).some(([key, value]) => before[key] !== value))
      ) {
        throw new Error('OpenTofu preview plan points to a resource outside the requested PR');
      }
      addresses.add(address);
    }
  }

  const imageBucket = plan.planned_values?.outputs?.image_bucket?.value;
  return imageBucket === bucket ? imageBucket : undefined;
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
    const plan = join(scratch, 'preview.tfplan');
    const planOptions = [...options, ...variables, `-out=${plan}`];
    if (operation === 'destroy') {
      planOptions.push('-destroy');
    }
    const planning = await executeOperation({
      directory,
      operation: 'plan',
      options: planOptions,
      env,
      events: join(scratch, 'plan.jsonl'),
      details: [],
    });
    if (planning.exitCode !== 0) {
      await hooks.onAttempt(planning);
      return { exitCode: planning.exitCode };
    }

    // The JSON includes sensitive attributes. Keep it out of the logs and PR comments.
    const document: unknown = await $`tofu -chdir=${directory} show -json ${plan}`
      .env(env)
      .quiet()
      .json();
    const imageBucket = validatePreviewPlan(document, project, pr);
    if (operation === 'apply' && !imageBucket) {
      throw new Error('Invalid preview image bucket output');
    }
    if (hooks.beforeAttempt && !(await hooks.beforeAttempt())) {
      return null;
    }
    const result = await executeOperation({
      directory,
      operation: 'apply',
      options: [...options, plan],
      env,
      events: join(scratch, 'apply.jsonl'),
      details: operationDetails(document, operation),
    });
    await hooks.onAttempt(result);
    if (operation === 'destroy' || result.exitCode !== 0) {
      return { exitCode: result.exitCode };
    }

    return { exitCode: result.exitCode, imageBucket };
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}
