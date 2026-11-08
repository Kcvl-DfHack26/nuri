import { $ } from 'bun';

import { requireEnv } from './context';

const repo = requireEnv('GITHUB_REPOSITORY');
const sha = requireEnv('GITHUB_SHA');

const project = requireEnv('PROJECT_ID');
const region = requireEnv('REGION');
const service = requireEnv('SERVICE');
if (`${project}/${region}/${service}` !== 'kcvlb4/asia-northeast1/nuri-staging') {
  throw new Error('Invalid production infrastructure target');
}
if (
  requireEnv('TOFU_PROVIDER') === Bun.env.DEPLOY_PROVIDER ||
  requireEnv('TOFU_ACCOUNT') === Bun.env.DEPLOY_ACCOUNT
) {
  throw new Error('Use the dedicated OpenTofu identity');
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
