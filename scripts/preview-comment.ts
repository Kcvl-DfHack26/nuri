export const previewMarker = '<!-- daylight-preview -->';
const requestLine = '- [ ] 🚀 **previewを配信** <!-- daylight-preview-request -->';
const checkedLine = requestLine.replace('[ ]', '[x]');

export function previewSha(body: string): string | undefined {
  if (!body.startsWith(`${previewMarker}\n`)) {
    return undefined;
  }
  const matches = [...body.matchAll(/^対象SHA: ([a-f0-9]{40})$/gm)];
  return matches.length === 1 ? matches[0]?.[1] : undefined;
}

export function parsePreviewRequest(input: {
  author: string;
  body: string;
  before?: string;
}): string | undefined {
  if (input.author !== 'github-actions[bot]' || !input.before) {
    return undefined;
  }
  if (input.before.split(requestLine).length !== 2) {
    return undefined;
  }
  // Only the checkbox may change. Editing the SHA or other content is not a request.
  if (input.body !== input.before.replace(requestLine, checkedLine)) {
    return undefined;
  }
  return previewSha(input.body);
}

export function assertPreviewTarget(input: {
  actorType: string;
  permission: string;
  repository: string;
  headRepository: string | undefined;
  state: string;
  base: string;
  sha: string;
  requestedSha?: string;
}) {
  if (input.actorType !== 'User' || !['write', 'admin'].includes(input.permission)) {
    throw new Error('previewの配信には利用者のwrite権限が必要です');
  }
  if (
    input.state !== 'open' ||
    input.headRepository !== input.repository ||
    input.base !== 'main'
  ) {
    throw new Error('同じリポジトリからmainへ向けた公開中PRだけ配信できます');
  }
  if (
    !/^[a-f0-9]{40}$/.test(input.sha) ||
    (input.requestedSha && input.requestedSha !== input.sha)
  ) {
    throw new Error('対象SHAが変わりました。最新コメントから実行してください');
  }
}

export function renderPreviewComment(input: {
  sha: string;
  status?: string;
  runUrl?: string;
  updateComment?: string;
}) {
  return [
    previewMarker,
    '### Daylight preview',
    '',
    `対象SHA: ${input.sha}`,
    '',
    input.status ?? 'このコミットはまだ配信していません。pushだけでは配信しません。',
    input.runUrl ? `[実行ログ](${input.runUrl})` : '',
    '',
    requestLine,
    '',
    'リポジトリにwrite権限がある人がチェックすると、iOS / Androidのpreviewを配信します。',
    'QRは対応するDevelopment Buildで開いてください。Expo Goはローカル開発サーバーを使います。',
    input.updateComment ? `\n${input.updateComment}` : '',
  ].join('\n');
}
