import { $ } from 'bun';
import { z } from 'zod';

import { previewMarker } from './comment';

export function requireEnv(name: string) {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`${name} が必要です`);
  }
  return value;
}

export const repository = requireEnv('GITHUB_REPOSITORY');

export const runUrl = `${Bun.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${Bun.env.GITHUB_RUN_ID}`;

export const prNumber = z.string().regex(/^[1-9]\d{0,8}$/);
export const commitSha = z.string().regex(/^[a-f0-9]{40}$/);
const pullRequest = z.object({
  html_url: z.url(),
  state: z.enum(['open', 'closed']),
  head: z.object({
    repo: z.object({ full_name: z.string() }).nullable(),
    sha: commitSha,
  }),
  base: z.object({ ref: z.string() }),
});
const previewComment = z.object({ id: z.int().positive(), body: z.string() });

export async function getPullRequest(number: string) {
  const endpoint = `repos/${repository}/pulls/${prNumber.parse(number)}`;
  const {
    html_url: url,
    state,
    head,
    base,
  } = pullRequest.parse(await $`gh api ${endpoint}`.json());
  return {
    number: Number(number),
    url,
    state,
    headRepository: head.repo?.full_name ?? '',
    sha: head.sha,
    baseRef: base.ref,
  };
}

export async function findComment(pr: number) {
  const endpoint = `repos/${repository}/issues/${pr}/comments`;
  const marker = JSON.stringify(`${previewMarker}\n`);
  const filter = `first(.[][] | select(.user.login == "github-actions[bot]" and (.body // "" | startswith(${marker})))) | {id, body}`;
  const result = (await $`gh api --paginate --slurp ${endpoint} | jq -c ${filter}`.text()).trim();
  return result ? previewComment.parse(JSON.parse(result)) : undefined;
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
