import { $ } from 'bun';

import { operationReport, postOperationReport } from './report-operation';

const path = Bun.argv[2];
if (!path) {
  throw new Error('Preview cleanup reporting requires a report file');
}
const reports = (await Bun.file(path).text())
  .split('\n')
  .filter(Boolean)
  .map((line) => operationReport.parse(JSON.parse(line)));
for (const report of reports) {
  try {
    await postOperationReport('Destroy', report);
  } catch (error) {
    const message = error instanceof $.ShellError ? error.stderr.toString().trim() : error;
    console.error(`PR #${report.pr} の OpenTofu Destroy コメントを投稿できませんでした。`, message);
    process.exitCode = 1;
  }
}
