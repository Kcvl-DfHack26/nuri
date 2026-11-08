import { $ } from 'bun';

import { mergedMainPr, requireEnv } from './context';

const repo = requireEnv('GITHUB_REPOSITORY');
const target = requireEnv('TARGET');
const operation = requireEnv('OPERATION');
if (!['nuri-staging', 'nuri-preview'].includes(target)) {
  throw new Error('Invalid target');
}
if (operation !== 'apply' && operation !== 'destroy') {
  throw new Error('Invalid operation');
}

const pr = await mergedMainPr(repo);
const action = operation === 'apply' ? 'Apply' : 'Destroy';
const result = Bun.env.RESULT;
const status =
  result === 'success' ? '✅ 完了' : result === 'cancelled' ? '⏹️ 実行中止' : '❌ ワークフロー失敗';
const log = Bun.env.OPERATION_LOG?.trim() ?? '';
const runUrl = `${requireEnv('GITHUB_SERVER_URL')}/${repo}/actions/runs/${requireEnv('GITHUB_RUN_ID')}/attempts/${requireEnv('GITHUB_RUN_ATTEMPT')}`;
const body = [
  `### 🧱 OpenTofu ${action} · \`${target}\``,
  '',
  status,
  '',
  '```text',
  log.length > 0 ? log : '実行ログなし。Actionsで停止箇所を確認。',
  '```',
  '',
  `SHA \`${requireEnv('GITHUB_SHA')}\` · [Actions 実行ログ](${runUrl})`,
].join('\n');

await $`gh pr comment ${pr} --repo ${repo} --body-file - < ${Buffer.from(body)}`;
