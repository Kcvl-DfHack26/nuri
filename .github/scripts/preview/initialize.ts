import { previewSha, renderPreviewComment } from './comment';
import { createComment, findComment, getPullRequest, repository, updateComment } from './github';

const pr = await getPullRequest(Bun.env.PR_NUMBER ?? '');
if (pr.state === 'open' && pr.headRepository === repository) {
  const comment = await findComment(pr.number);
  if (!comment || previewSha(comment.body) !== pr.sha) {
    const body = renderPreviewComment({
      sha: pr.sha,
      pullRequest: pr,
      canRequest: Bun.env.PREVIEW_CAN_PUBLISH === 'true',
    });
    if (comment) {
      await updateComment(comment.id, body);
    } else {
      await createComment(pr.number, body);
    }
  }
}
