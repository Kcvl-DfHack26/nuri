import { $ } from 'bun';

import { previewMarker } from './comment';

export const repository = Bun.env.GITHUB_REPOSITORY ?? '';
if (!repository) {
  throw new Error('GITHUB_REPOSITORY が必要です');
}

export const runUrl = `${Bun.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${Bun.env.GITHUB_RUN_ID}`;

export async function getPullRequest(number: string) {
  if (!/^[1-9]\d{0,8}$/.test(number)) {
    throw new Error('PR番号が不正です');
  }
  const endpoint = `repos/${repository}/pulls/${number}`;
  const fields = '[.html_url, .state, (.head.repo.full_name // ""), .head.sha] | @tsv';
  const response = await $`gh api ${endpoint} --jq ${fields}`.text();
  const [url, state, headRepository, sha] = response.trimEnd().split('\t');
  if (!url || !state || !sha) {
    throw new Error('PR情報を取得できませんでした');
  }
  return { number: Number(number), url, state, headRepository, sha };
}

export async function findComment(pr: number) {
  const endpoint = `repos/${repository}/issues/${pr}/comments`;
  const filter = `first(.[] | select(.user.login == "github-actions[bot]" and (.body // "" | startswith(${JSON.stringify(`${previewMarker}\n`)})))) | [.id, .body] | @base64`;
  const [row] = (await $`gh api --paginate ${endpoint} --jq ${filter}`.text()).trim().split('\n');
  if (!row) {
    return undefined;
  }
  const decoded: unknown = JSON.parse(Buffer.from(row, 'base64').toString());
  if (!Array.isArray(decoded) || typeof decoded[0] !== 'number' || typeof decoded[1] !== 'string') {
    throw new Error('プレビューコメントを読み取れませんでした');
  }
  return { id: decoded[0], body: decoded[1] };
}

export async function updateComment(id: number, body: string) {
  const endpoint = `repos/${repository}/issues/comments/${id}`;
  await $`gh api ${endpoint} --method PATCH --raw-field ${`body=${body}`}`.quiet();
}

export async function createComment(pr: number, body: string) {
  const endpoint = `repos/${repository}/issues/${pr}/comments`;
  return (
    await $`gh api ${endpoint} --method POST --raw-field ${`body=${body}`} --jq .id`.text()
  ).trim();
}
