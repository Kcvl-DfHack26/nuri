import { $ } from 'bun';

export function requireEnv(name: string) {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Set ${name}`);
  }
  return value;
}

export function readTarget() {
  const target = Bun.argv[2];
  if (target !== 'preview' && target !== 'production') {
    throw new Error('Expected an OpenTofu target of preview or production');
  }
  return target;
}

export function readOperation() {
  const operation = requireEnv('OPERATION');
  if (operation !== 'plan' && operation !== 'apply') {
    throw new Error('Invalid operation');
  }
  return operation;
}

export async function mergedMainPr(repo: string) {
  const pr = requireEnv('PR_NUMBER');
  if (!/^[1-9]\d{0,8}$/.test(pr)) {
    throw new Error('Invalid PR number');
  }

  const merged =
    await $`gh api repos/${repo}/pulls/${pr} --jq '.merged and (.base.ref == "main")'`.text();
  if (merged.trim() !== 'true') {
    throw new Error('Expected a PR merged into main');
  }
  return pr;
}
