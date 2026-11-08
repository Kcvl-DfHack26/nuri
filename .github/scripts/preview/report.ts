import { previewSha, renderPreviewComment } from './comment';
import { findComment, getPullRequest, runUrl, updateComment } from './github';

const env = Bun.env;
const pr = await getPullRequest(env.PREVIEW_PR ?? '');
const comment = await findComment(pr.number);
if (
  pr.state === 'open' &&
  pr.sha === env.PREVIEW_SHA &&
  comment &&
  String(comment.id) === env.PREVIEW_COMMENT &&
  previewSha(comment.body) === pr.sha
) {
  const { PREVIEW_RESULT: result, PREVIEW_ORIGIN: origin, PREVIEW_DEPLOYED_AT: createdAt } = env;
  if (result === 'success' && (!origin || !createdAt)) {
    throw new Error('配信先または配信日時がありません');
  }
  await updateComment(
    comment.id,
    renderPreviewComment({
      sha: pr.sha,
      pullRequest: pr,
      canRequest: result !== 'skipped',
      ...(result === 'skipped' ? {} : { status: result === 'success' ? '✅ 完了' : '❌ 失敗' }),
      ...(result === 'success' && origin && createdAt ? { deployment: { origin, createdAt } } : {}),
      runUrl,
    }),
  );
}
