import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { readOperation, requireEnv } from './context';

const operation = readOperation();
const directory = 'infra';
const shellEnv = { ...Bun.env, TF_IN_AUTOMATION: 'true' };
const options = ['-input=false', '-no-color', '-lock-timeout=5m'];

async function productionVars(scratch: string) {
  const variables = requireEnv('TOFU_VARIABLES');
  let input: unknown;
  try {
    input = JSON.parse(variables);
  } catch {
    throw new Error('Invalid OpenTofu production variables JSON');
  }
  if (
    input === null ||
    typeof input !== 'object' ||
    !('deploy_application' in input) ||
    input.deploy_application !== true ||
    !('deletion_protection' in input) ||
    input.deletion_protection !== true ||
    'database_password' in input
  ) {
    throw new Error('Invalid OpenTofu production variables');
  }

  const project = requireEnv('PROJECT_ID');
  const service = requireEnv('SERVICE');
  const file = join(scratch, 'production.tfvars.json');
  await Bun.write(
    file,
    JSON.stringify({
      ...input,
      project_id: project,
      region: requireEnv('REGION'),
      name: service,
      github_repository: requireEnv('GITHUB_REPOSITORY'),
      github_repository_id: requireEnv('GITHUB_REPOSITORY_ID'),
    }),
  );
  await $`tofu -chdir=${directory} init -input=false -lockfile=readonly -backend-config=bucket=${project}-tofu-state -backend-config=prefix=nuri/staging`.env(
    shellEnv,
  );

  const address = 'google_cloud_run_v2_service.api[0]';
  const state = await $`tofu -chdir=${directory} state list ${address}`.env(shellEnv).text();
  if (state.trim() !== address) {
    throw new Error('Expected the existing production Cloud Run service');
  }

  const secret =
    await $`gcloud secrets versions access latest --project=${project} --secret=${service}-database-url`
      .quiet()
      .nothrow();
  if (secret.exitCode !== 0) {
    throw new Error('Could not read the production database secret');
  }
  let password: string;
  try {
    password = decodeURIComponent(new URL(secret.text().trim()).password);
  } catch {
    throw new Error('Invalid production database secret');
  }
  if (password.length < 24) {
    throw new Error('Invalid production database password');
  }

  const masked = password.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.log(`::add-mask::${masked}`);
  return { file, password };
}

function deletionsInPlan(input: unknown) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid OpenTofu plan');
  }
  if (!('resource_changes' in input)) {
    return false;
  }
  if (!Array.isArray(input.resource_changes)) {
    throw new Error('Invalid OpenTofu resource changes');
  }
  return input.resource_changes.some((resource: unknown) => {
    if (
      resource === null ||
      typeof resource !== 'object' ||
      !('change' in resource) ||
      resource.change === null ||
      typeof resource.change !== 'object' ||
      !('actions' in resource.change) ||
      !Array.isArray(resource.change.actions)
    ) {
      throw new Error('Invalid OpenTofu resource change');
    }
    return resource.change.actions.includes('delete');
  });
}

process.umask(0o077);
const scratch = await mkdtemp(join(requireEnv('RUNNER_TEMP'), 'nuri-opentofu-'));
try {
  const plan = join(scratch, 'operation.tfplan');
  const { file, password } = await productionVars(scratch);
  const planOptions = [...options, `-out=${plan}`, `-var-file=${file}`];
  const operationEnv = { ...shellEnv, TF_VAR_database_password: password };

  await $`tofu -chdir=${directory} plan ${planOptions}`.env(operationEnv);
  if (operation === 'apply') {
    const shown = await $`tofu -chdir=${directory} show -json ${plan}`
      .env(operationEnv)
      .quiet()
      .nothrow();
    if (shown.exitCode !== 0) {
      throw new Error('Could not read the OpenTofu plan');
    }
    let planContents: unknown;
    try {
      planContents = JSON.parse(shown.text());
    } catch {
      throw new Error('Invalid OpenTofu plan JSON');
    }
    if (deletionsInPlan(planContents)) {
      throw new Error(
        'The plan contains a deletion or replacement. Review it in a separate infrastructure change.',
      );
    }

    const result = await $`tofu -chdir=${directory} apply ${options} ${plan}`
      .env(operationEnv)
      .nothrow();
    process.exitCode = result.exitCode;
  }
} finally {
  await rm(scratch, { force: true, recursive: true });
}
