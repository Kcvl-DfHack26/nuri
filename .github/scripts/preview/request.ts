import { $ } from 'bun';
import { appendFile } from 'node:fs/promises';

import {
  assertPreviewTarget,
  parsePreviewRequest,
  previewSetupPendingMarker,
  previewSha,
  renderPreviewComment,
} from './comment';
import {
  createComment,
  findComment,
  getPullRequest,
  repository,
  runUrl,
  updateComment,
} from './github';

async function requestPreview() {
  const env = Bun.env;
  const isComment = env.GITHUB_EVENT_NAME === 'issue_comment';
  const commentOnly =
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.PREVIEW_OPERATION === 'comment';
  const canRequest = !commentOnly || env.PREVIEW_CAN_PUBLISH === 'true';
  const requestedSha = isComment
    ? parsePreviewRequest({
        author: env.COMMENT_AUTHOR ?? '',
        body: env.COMMENT_BODY ?? '',
        ...(env.COMMENT_BEFORE ? { before: env.COMMENT_BEFORE } : {}),
      })
    : undefined;
  if (isComment && !requestedSha) {
    return;
  }

  const permissionUrl = `repos/${repository}/collaborators/${env.GITHUB_ACTOR}/permission`;
  const permission = (await $`gh api ${permissionUrl} --jq .permission`.text()).trim();
  const pr = await getPullRequest(env.REQUEST_PR ?? '');
  assertPreviewTarget({
    actorType: env.SENDER_TYPE ?? '',
    permission,
    repository,
    headRepository: pr.headRepository,
    state: pr.state,
    sha: pr.sha,
    ...(requestedSha ? { requestedSha } : {}),
  });

  const comment = await findComment(pr.number);
  if (
    isComment &&
    (!comment ||
      String(comment.id) !== env.COMMENT_ID ||
      comment.body !== env.COMMENT_BODY ||
      previewSha(comment.body) !== pr.sha)
  ) {
    throw new Error('最新のpreviewコメントから実行してください');
  }

  // 旧形式のコメントは同じSHAでも表へ更新する。
  const currentTable = comment?.body.split('\n', 2)[1] === `<!-- nuri-preview-sha: ${pr.sha} -->`;
  const activateRequest = canRequest && comment?.body.includes(previewSetupPendingMarker);
  if (commentOnly && currentTable && !activateRequest) {
    return;
  }

  const body = renderPreviewComment({
    sha: pr.sha,
    pullRequest: pr,
    canRequest,
    ...(commentOnly ? {} : { status: '⏳ 配信中' }),
    runUrl,
  });
  if (comment) {
    await updateComment(comment.id, body);
  }
  const commentId = comment?.id ?? (await createComment(pr.number, body));
  if (commentOnly) {
    return;
  }

  if (!env.GITHUB_OUTPUT) {
    throw new Error('GITHUB_OUTPUT が必要です');
  }
  await appendFile(env.GITHUB_OUTPUT, `pr=${pr.number}\nsha=${pr.sha}\ncomment=${commentId}\n`);
}

await requestPreview();
