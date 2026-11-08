export const previewMarker = '<!-- expo-hono-opentofu-starter-preview -->';
export const previewSetupPendingMarker = '<!-- nuri-preview-setup-pending -->';
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
  canRequest?: boolean;
  deployment?: { origin: string; createdAt: string };
}) {
  const { sha, pullRequest, runUrl, canRequest = true, deployment } = input;
  const heading = pullRequest
    ? `PR [#${pullRequest.number}](${pullRequest.url}) · [\`${sha.slice(0, 7)}\`](${pullRequest.url}/commits/${sha})`
    : `nuri PRプレビュー · \`${sha.slice(0, 7)}\``;
  const status = input.status ?? (canRequest ? '⚪ 未配信' : '🔧 設定待ち');
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
  const sharedCost = '🔥 Hono API行と共通';
  const gcpRates = [
    '**3つのプレビューで共通**',
    '[Cloud Run（東京）](https://cloud.google.com/run/pricing)：CPU $0.00144 / vCPU・分',
    'メモリ $0.00015 / GiB・分',
    'リクエスト $0.40 / 100万件',
    '[Artifact Registry](https://cloud.google.com/artifact-registry/pricing)：$0.10 / GiB・月',
    '[Cloud Storage](https://cloud.google.com/storage/pricing)（state）：$0.023 / GiB・月',
    '共有無料枠の適用前。外向き通信とstate操作は別',
  ].join('<br>');
  const expoCost = [
    sharedCost,
    '**EAS消費**：Build 0件 · Workflows 0分 · Update 0 MAU',
    '[Expo Free月間枠](https://expo.dev/pricing)：iOS・Android各15ビルド · 60分 · 1,000 MAU',
  ].join('<br>');

  return [
    previewMarker,
    `<!-- nuri-preview-sha: ${sha} -->`,
    `### 🚀 ${heading}${runUrl ? ` · [Actions ↗](${runUrl})` : ''}`,
    '',
    '| プレビュー | ビルド・デプロイ | デプロイ日時 (JST) | 💰 費用・利用枠 |',
    '| --- | --- | --- | --- |',
    `| 🌐 **Expo Web**<br>${webUrl ? `[${webUrl}](${webUrl})` : '—'} | ${status} | ${time} | ${sharedCost} |`,
    `| 🔥 **Hono API**<br>${apiUrl ? `[${apiUrl}](${apiUrl})` : '—'} | ${status} | ${time} | ${gcpRates} |`,
    `| 📱 **Expo Go**<br>${go} | ${status} | ${time} | ${expoCost} |`,
    '',
    ...(canRequest
      ? [
          requestLine,
          '',
          'main宛てのPRは自動配信します。write権限を持つ人はチェックして配信を再実行できます。',
        ]
      : [previewSetupPendingMarker, 'プレビューの初期設定後に配信できます。']),
    ...(deployment
      ? ['Expo Goはプロジェクトと同じSDKを使ってください。初回起動時はバンドルを生成します。']
      : []),
    '',
    '#### 🧹 Cleanup',
    '',
    '- **更新成功後** 旧イメージを削除',
    '- **マージ・クローズ後** OpenTofuでPR専用サービスを削除し、イメージとstateを回収',
    '- **実行ログ** Apply・Destroyのたびに、このPRへコードブロック付きの新規コメントを投稿',
    '- **定期処理** 取りこぼしを日次で回収し、14日を超えるイメージを削除',
  ].join('\n');
}
