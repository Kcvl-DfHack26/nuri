import { $ } from 'bun';

import { postOperationReport } from './report-operation';

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
  const cleanupExitCode = 'cleanupExitCode' in report ? report.cleanupExitCode : undefined;
  if (
    cleanupExitCode !== undefined &&
    (typeof cleanupExitCode !== 'number' ||
      !Number.isInteger(cleanupExitCode) ||
      cleanupExitCode < 1 ||
      cleanupExitCode > 255)
  ) {
    throw new Error('Invalid cleanup exit code');
  }
  return {
    pr: report.pr,
    log: report.log,
    exitCode: report.exitCode,
    ...(cleanupExitCode === undefined ? {} : { cleanupExitCode }),
  };
}

const path = Bun.argv[2];
if (!path) {
  throw new Error('Preview cleanup reporting requires a report file');
}
const reports = (await Bun.file(path).text()).split('\n').filter(Boolean).map(parseReport);
for (const report of reports) {
  try {
    await postOperationReport('Destroy', report);
  } catch (error) {
    const message = error instanceof $.ShellError ? error.stderr.toString().trim() : error;
    console.error(`PR #${report.pr} の OpenTofu Destroy コメントを投稿できませんでした。`, message);
    process.exitCode = 1;
  }
}
