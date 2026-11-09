import { requireMainWithPassingCi } from '../ci/verify-main';
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

await requireMainWithPassingCi(repo, sha);
