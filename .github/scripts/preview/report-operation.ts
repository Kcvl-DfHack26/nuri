import { $ } from 'bun';
import { z } from 'zod';

import { repository, requireEnv } from './github';

export const operationReport = z.object({
  pr: z.int().min(1).max(999_999_999),
  log: z.string(),
  exitCode: z.int().min(0).max(255),
  cleanupExitCode: z.int().min(1).max(255).optional(),
});

export async function postOperationReport(
  operation: 'Apply' | 'Destroy',
  { pr, log, exitCode, cleanupExitCode }: z.infer<typeof operationReport>,
) {
  requireEnv('GH_TOKEN');
  const runUrl = `${requireEnv('GITHUB_SERVER_URL')}/${repository}/actions/runs/${requireEnv('GITHUB_RUN_ID')}/attempts/${requireEnv('GITHUB_RUN_ATTEMPT')}`;
  const status =
    exitCode !== 0
      ? `❌ 失敗（終了コード ${exitCode}）`
      : cleanupExitCode
        ? `⚠️ Destroy 完了（終了コード 0）・後続の cleanup 失敗（終了コード ${cleanupExitCode}）`
        : '✅ 完了（終了コード 0）';
  const excerpt =
    log.length > 58_000
      ? `${log.slice(0, 58_000)}\n… 続きは Actions の実行ログを参照`
      : log.trimEnd();
  const body = [
    `### 🧱 OpenTofu ${operation}`,
    '',
    status,
    '',
    '<details>',
    '<summary>実行ログとリソース設定</summary>',
    '',
    '```text',
    excerpt || '実行ログなし。Actions で詳細を確認できます。',
    '```',
    '',
    '</details>',
    '',
    `[Actions の実行ログ](${runUrl})`,
  ].join('\n');
  const payload = new Blob([JSON.stringify({ body })]);
  await $`gh api repos/${repository}/issues/${pr}/comments --method POST --input - < ${payload}`.quiet();
}

if (import.meta.main) {
  await postOperationReport(
    'Apply',
    operationReport.parse({
      pr: Number(requireEnv('PREVIEW_PR')),
      log: Bun.env.TOFU_LOG ?? '',
      exitCode: Number(requireEnv('TOFU_EXIT')),
    }),
  );
}
