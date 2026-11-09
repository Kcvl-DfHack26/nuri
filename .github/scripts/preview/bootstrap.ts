import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const directory = 'infra/preview';

async function manage() {
  const {
    OPERATION: operation,
    PREVIEW_GCP_PROJECT_ID: project,
    RUNNER_TEMP: runnerTemp,
  } = Bun.env;
  if (operation !== 'plan' && operation !== 'apply') {
    throw new Error('Expected OpenTofu plan or apply');
  }
  if (project !== 'kcvlb4') {
    throw new Error('Set PREVIEW_GCP_PROJECT_ID to kcvlb4');
  }
  if (!runnerTemp) {
    throw new Error('RUNNER_TEMP is required');
  }

  process.umask(0o077);
  const scratch = await mkdtemp(join(runnerTemp, 'nuri-preview-bootstrap-'));
  const plan = join(scratch, 'bootstrap.tfplan');
  const flags = ['-input=false', '-no-color', '-lock-timeout=5m'];
  const shell = $.env({ ...Bun.env, TF_IN_AUTOMATION: 'true' });
  try {
    await shell`tofu -chdir=${directory} init -input=false -lockfile=readonly`;
    await shell`tofu -chdir=${directory} plan ${flags} -var=project_id=${project} -out=${plan}`;
    if (operation === 'apply') {
      // 共有基盤の削除や置換は、このワークフローでは適用しない。
      const safe =
        await shell`tofu -chdir=${directory} show -json ${plan} | jq -er 'all(.resource_changes[]?; .change.actions | index("delete") | not)'`.text();
      if (safe.trim() !== 'true') {
        throw new Error('Preview bootstrap plan includes a deletion or replacement');
      }
      await shell`tofu -chdir=${directory} apply ${flags} ${plan}`;
      await shell`tofu -chdir=${directory} output -no-color`;
    }
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}

await manage();
