export const previewMarker = '<!-- expo-hono-opentofu-starter-preview -->';
const requestLine =
  '- [ ] 🚀 **previewを配信** <!-- expo-hono-opentofu-starter-preview-request -->';
const checkedLine = requestLine.replace('[ ]', '[x]');

export function previewSha(body: string): string | undefined {
  if (!body.startsWith(`${previewMarker}\n`)) {
    return undefined;
  }
  const matches = [
    ...body.matchAll(/^(?:<!-- nuri-preview-sha: ([a-f0-9]{40}) -->|対象SHA: ([a-f0-9]{40}))$/gm),
  ];
  return matches.length === 1 ? (matches[0]?.[1] ?? matches[0]?.[2]) : undefined;
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
  pullRequest?: { number: number; url: string };
  status?: string;
  runUrl?: string;
  deployment?: { origin: string; createdAt: string };
}) {
  const { sha, pullRequest, runUrl, deployment } = input;
  const heading = pullRequest
    ? `PR [#${pullRequest.number}](${pullRequest.url}) · [\`${sha.slice(0, 7)}\`](${pullRequest.url}/commits/${sha})`
    : `nuri PRプレビュー · \`${sha.slice(0, 7)}\``;
  const status = input.status ?? '未配信';
  const time = deployment
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(deployment.createdAt))
    : '—';
  const webUrl = deployment ? `${deployment.origin}/` : undefined;
  const apiUrl = deployment ? `${deployment.origin}/api/recipes?offset=0` : undefined;
  const go = deployment
    ? `\`exps://${new URL(deployment.origin).host}\`<br><img src="${deployment.origin}/expo-go/qr.svg?sha=${sha}" alt="Expo Goで開くQR" width="128">`
    : '—';

  return [
    previewMarker,
    `<!-- nuri-preview-sha: ${sha} -->`,
    `### ${heading}${runUrl ? ` · [Actions ↗](${runUrl})` : ''}`,
    '',
    '| プレビュー | ビルド・デプロイ | デプロイ日時 (JST) |',
    '| --- | --- | --- |',
    `| **Expo Web**<br>${webUrl ? `[${webUrl}](${webUrl})` : '—'} | ${status} | ${time} |`,
    `| **Hono API**<br>${apiUrl ? `[${apiUrl}](${apiUrl})` : '—'} | ${status} | ${time} |`,
    `| **Expo Go**<br>${go} | ${status} | ${time} |`,
    '',
    requestLine,
    '',
    'write権限を持つ人がチェックすると、3つのプレビューを一緒に配信します。',
    ...(deployment
      ? ['Expo Goはプロジェクトと同じSDKを使ってください。初回起動時はバンドルを生成します。']
      : []),
    '',
    '<details>',
    '<summary>無料枠・GCPの概算・cleanup</summary>',
    '',
    '- Expo Free は月 Android 15／iOS 15 ビルド、Workflows 60分、Update 1,000 MAU。このプレビューの消費はすべて0。 [Expo料金表](https://expo.dev/pricing)',
    '- Cloud Run は最小0台。1 vCPU・2 GiBの課金時間10分で約 $0.017。Registryに1 GiBを7日保存すると約 $0.023。いずれも共有の無料枠、リクエスト、外向き通信を別にした目安。 [Cloud Run料金表](https://cloud.google.com/run/pricing) · [Registry料金表](https://cloud.google.com/artifact-registry/pricing)',
    '- 更新成功後に旧リビジョンとイメージを削除。マージ・クローズ後はタグも削除し、取りこぼしは日次で回収。Registryは14日を超えるイメージを定期削除。',
    '',
    '</details>',
  ].join('\n');
}
