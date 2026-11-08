import { $ } from 'bun';

function parseReport(line: string) {
  const report: unknown = JSON.parse(line);
  if (
    !report ||
    typeof report !== 'object' ||
    !('pr' in report) ||
    typeof report.pr !== 'number' ||
    !Number.isSafeInteger(report.pr) ||
    report.pr < 1 ||
    !('log' in report) ||
    typeof report.log !== 'string' ||
    !('exitCode' in report) ||
    typeof report.exitCode !== 'number' ||
    !Number.isInteger(report.exitCode)
  ) {
    throw new Error('Invalid preview cleanup report');
  }
  return { pr: report.pr, log: report.log, exitCode: report.exitCode };
}

const path = Bun.argv[2];
const { GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GH_TOKEN } =
  Bun.env;
if (
  !path ||
  !GITHUB_REPOSITORY ||
  !GITHUB_SERVER_URL ||
  !GITHUB_RUN_ID ||
  !GITHUB_RUN_ATTEMPT ||
  !GH_TOKEN
) {
  throw new Error(
    'Preview cleanup reporting requires a report file and the GitHub Actions environment',
  );
}
const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}`;
const reports = (await Bun.file(path).text()).trimEnd().split('\n');
for (const line of reports) {
  const { pr, log, exitCode } = parseReport(line);
  const result = exitCode === 0 ? '✅ 削除完了' : `❌ 失敗（終了コード ${exitCode}）`;
  const excerpt =
    log.length > 58_000
      ? `${log.slice(0, 58_000)}\n… 続きは Actions の実行ログを参照`
      : log.trimEnd();
  const body = [
    '### 🧹 Preview Cleanup',
    '',
    result,
    '',
    '```text',
    excerpt,
    '```',
    '',
    `[Actions の実行ログ](${runUrl})`,
  ].join('\n');
  try {
    const payload = new Blob([JSON.stringify({ body })]);
    await $`gh api repos/${GITHUB_REPOSITORY}/issues/${pr}/comments --method POST --input - < ${payload}`.quiet();
  } catch (error) {
    const message = error instanceof $.ShellError ? error.stderr.toString().trim() : error;
    console.error(`PR #${pr} の cleanup コメントを投稿できませんでした。`, message);
    process.exitCode = 1;
  }
}
