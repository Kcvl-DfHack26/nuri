import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const directory = 'infra/preview';

async function verifyMain() {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha } = Bun.env;
  if (!repo || !sha) {
    throw new Error('GitHub Actions repository and SHA are required');
  }
  const head = await $`gh api repos/${repo}/git/ref/heads/main --jq .object.sha`.text();
  if (head.trim() !== sha) {
    throw new Error('The current main SHA has changed');
  }
  const runs = `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&status=success`;
  const passed =
    await $`gh api ${runs} --jq '[.workflow_runs[] | select(.event == "push")] | length'`.text();
  if (!/^[1-9]\d*$/.test(passed.trim())) {
    throw new Error('No successful CI push run for this main SHA');
  }
}

async function manage() {
  const {
    OPERATION: operation,
    PREVIEW_GCP_PROJECT_ID: project,
    RUNNER_TEMP: runnerTemp,
  } = Bun.env;
  if (operation !== 'plan' && operation !== 'apply') {
    throw new Error('Expected OpenTofu plan or apply');
  }
  if (!project || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || project === 'kcvlb4') {
    throw new Error('Set PREVIEW_GCP_PROJECT_ID to a dedicated preview project');
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

switch (Bun.argv[2]) {
  case 'verify':
    await verifyMain();
    break;
  case 'manage':
    await manage();
    break;
  default:
    throw new Error('Expected preview bootstrap verify or manage');
}
