import { $ } from 'bun';

import { repository, requireEnv } from './github';

export async function postOperationReport(
  operation: 'Apply' | 'Destroy',
  {
    pr,
    log,
    exitCode,
    cleanupExitCode,
  }: { pr: number; log: string; exitCode: number; cleanupExitCode?: number },
) {
  if (!Number.isSafeInteger(pr) || pr < 1 || pr > 999_999_999) {
    throw new Error('Invalid pull request number');
  }
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw new Error('Invalid OpenTofu exit code');
  }
  requireEnv('GH_TOKEN');
  const runUrl = `${requireEnv('GITHUB_SERVER_URL')}/${repository}/actions/runs/${requireEnv('GITHUB_RUN_ID')}/attempts/${requireEnv('GITHUB_RUN_ATTEMPT')}`;
  const status =
    exitCode !== 0
      ? `❌ 失敗（終了コード ${exitCode}）`
      : cleanupExitCode
        ? `⚠️ Destroy 完了・後続の cleanup 失敗（終了コード ${cleanupExitCode}）`
        : '✅ 完了';
  const excerpt =
    log.length > 58_000
      ? `${log.slice(0, 58_000)}\n… 続きは Actions の実行ログを参照`
      : log.trimEnd();
  const body = [
    `### 🧱 OpenTofu ${operation}`,
    '',
    status,
    '',
    '```text',
    excerpt || '実行ログなし。Actions で詳細を確認できます。',
    '```',
    '',
    `[Actions の実行ログ](${runUrl})`,
  ].join('\n');
  const payload = new Blob([JSON.stringify({ body })]);
  await $`gh api repos/${repository}/issues/${pr}/comments --method POST --input - < ${payload}`.quiet();
}

if (import.meta.main) {
  await postOperationReport('Apply', {
    pr: Number(requireEnv('PREVIEW_PR')),
    log: Bun.env.TOFU_LOG ?? '',
    exitCode: Number(requireEnv('TOFU_EXIT')),
  });
}
