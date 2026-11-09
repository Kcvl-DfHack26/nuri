import { $ } from 'bun';

export async function requireMainWithPassingCi(repo: string, sha: string) {
  const head = await $`gh api repos/${repo}/git/ref/heads/main --jq .object.sha`.text();
  if (head.trim() !== sha) {
    throw new Error('The current main SHA has changed');
  }

  const runs = `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&event=push&status=success`;
  const passed = await $`gh api ${runs} --jq .total_count`.text();
  if (!/^[1-9]\d*$/.test(passed.trim())) {
    throw new Error('No successful CI push run for this main SHA');
  }
}

if (import.meta.main) {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA, TARGET_SHA } = Bun.env;
  const sha = TARGET_SHA ?? GITHUB_SHA;
  if (!repo || !sha) {
    throw new Error('GitHub Actions repository and SHA are required');
  }
  await requireMainWithPassingCi(repo, sha);
}
