import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

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

export async function removePreviewState(project: string, pr: string) {
  const object = `gs://${bucketName(project)}/pr-${pr}/default.tfstate`;
  await $`gcloud storage rm ${object} --all-versions --quiet`;
}

const target = z.object({
  project: z.string(),
  region: z.string().regex(/^[a-z0-9-]+$/),
  service: z.string().regex(/^[a-z0-9-]+$/),
  image_bucket: z.string().regex(/^[a-z0-9-]{3,63}$/),
  image_role: z.string(),
  runtime_member: z.string(),
});

const targetOutput = z.object({
  preview_target: z.object({ value: target }),
});
const plannedTarget = z.object({ planned_values: z.object({ outputs: targetOutput }) });
const previewOutputs = targetOutput.extend({
  preview_origin: z.object({ value: z.url().regex(/^https:\/\/[a-z0-9.-]+\.run\.app$/) }),
});
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
});

// The credentials cover all previews. Check the prior targets of this saved plan.
export function validatePreviewPlan(
  document: unknown,
  {
    project,
    region,
    service,
    image_bucket: bucket,
    image_role: role,
    runtime_member: member,
  }: z.infer<typeof target>,
) {
  const plan = previewPlan.parse(document);
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
      { id: bucket, project, location: region.toUpperCase(), name: bucket },
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
}

export async function runPreviewTofu(
  project: string,
  pr: string,
  operation: 'inspect' | 'apply' | 'destroy',
  shouldApply?: () => Promise<boolean>,
) {
  const runnerTemp = Bun.env.RUNNER_TEMP;
  if (!runnerTemp) {
    throw new Error('RUNNER_TEMP is required');
  }
  const scratch = await mkdtemp(join(runnerTemp, `nuri-preview-pr-${pr}-`));
  const tofu = $.env({
    ...Bun.env,
    TF_IN_AUTOMATION: 'true',
    TF_DATA_DIR: join(scratch, 'tofu'),
    TF_WORKSPACE: 'default',
  });
  const variables = [`-var=project_id=${project}`, `-var=pr_number=${pr}`];
  const plan = join(scratch, 'preview.tfplan');
  try {
    await tofu`tofu -chdir=${directory} init -reconfigure -input=false -no-color -lockfile=readonly \
      -backend-config=bucket=${bucketName(project)} -backend-config=prefix=pr-${pr}`;

    // A destroy plan removes outputs. Resolve the target from the current HCL without refresh.
    const targetFlags = operation === 'apply' ? [] : ['-refresh=false'];
    await tofu`tofu -chdir=${directory} plan ${options} ${variables} ${targetFlags} -out=${plan}`.quiet();
    const planned: unknown = await tofu`tofu -chdir=${directory} show -json ${plan}`.json();
    const expected = plannedTarget.parse(planned).planned_values.outputs.preview_target.value;
    if (operation === 'inspect') {
      return { target: expected };
    }

    let changes = planned;
    if (operation === 'destroy') {
      await tofu`tofu -chdir=${directory} plan ${options} ${variables} -destroy -out=${plan}`;
      changes = await tofu`tofu -chdir=${directory} show -json ${plan}`.json();
    }
    validatePreviewPlan(changes, expected);
    if (shouldApply && !(await shouldApply())) {
      return;
    }

    await tofu`tofu -chdir=${directory} apply ${options} ${plan}`;
    if (operation === 'destroy') {
      return { target: expected };
    }
    const outputs = previewOutputs.parse(await tofu`tofu -chdir=${directory} output -json`.json());
    if (!Bun.deepEquals(outputs.preview_target.value, expected)) {
      throw new Error('Applied preview target differs from the saved plan');
    }
    return { target: expected, origin: outputs.preview_origin.value };
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}
