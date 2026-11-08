export const previewMarker = '<!-- expo-hono-opentofu-starter-preview -->';
const requestLine =
  '- [ ] 🚀 **previewを配信** <!-- expo-hono-opentofu-starter-preview-request -->';
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
  sha: string;
  requestedSha?: string;
}) {
  if (input.actorType !== 'User' || !['write', 'admin'].includes(input.permission)) {
    throw new Error('previewの配信には利用者のwrite権限が必要です');
  }
  if (input.state !== 'open' || input.headRepository !== input.repository) {
    throw new Error('同じリポジトリの公開中PRだけ配信できます');
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
  origin?: string;
}) {
  const origin = input.origin;
  return [
    previewMarker,
    '### nuri PRプレビュー',
    '',
    `対象SHA: ${input.sha}`,
    '',
    input.status ?? 'このコミットはまだ配信していません。pushだけでは配信しません。',
    input.runUrl ? `[実行ログ](${input.runUrl})` : '',
    '',
    requestLine,
    '',
    'リポジトリにwrite権限がある人がチェックすると、このPRのプレビューを作成します。',
    ...(origin
      ? [
          '',
          `- [Expo Web](${origin}/)`,
          `- [Hono APIのレシピ](${origin}/api/recipes?offset=0)`,
          `- Expo Goの接続先 \`exps://${new URL(origin).host}\``,
          '',
          `![対応するExpo Goで開くQR](${origin}/expo-go/qr.svg?sha=${input.sha})`,
          '',
          'Expo Goはプロジェクトと同じSDKを使ってください。初回起動時はバンドル生成に時間がかかります。',
        ]
      : []),
  ].join('\n');
}
