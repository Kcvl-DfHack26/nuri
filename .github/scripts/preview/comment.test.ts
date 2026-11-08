import { describe, expect, test } from 'bun:test';

import {
  assertPreviewTarget,
  parsePreviewRequest,
  previewSetupPendingMarker,
  previewSha,
  renderPreviewComment,
} from './comment';

const sha = 'a'.repeat(40);
const before = renderPreviewComment({ sha });
const body = before.replace('- [ ]', '- [x]');
const target = {
  actorType: 'User',
  permission: 'write',
  repository: 'owner/repo',
  headRepository: 'owner/repo',
  state: 'open',
  sha,
  requestedSha: sha,
};

describe('preview request', () => {
  test('accepts the bot checkbox transition and returns its exact commit', () => {
    expect(parsePreviewRequest({ author: 'github-actions[bot]', body, before })).toBe(sha);
  });

  test('recognizes the SHA on an existing preview comment', () => {
    expect(previewSha(`${before.split('\n')[0]}\n対象SHA: ${sha}`)).toBe(sha);
  });

  test('ignores forged comments, checked comments and bot status edits', () => {
    expect(parsePreviewRequest({ author: 'contributor', body, before })).toBeUndefined();
    expect(parsePreviewRequest({ author: 'github-actions[bot]', body })).toBeUndefined();
    expect(
      parsePreviewRequest({ author: 'github-actions[bot]', body, before: body }),
    ).toBeUndefined();
    expect(
      parsePreviewRequest({ author: 'github-actions[bot]', body: before, before: body }),
    ).toBeUndefined();
  });

  test('rejects an edited SHA or additional edits accompanying the click', () => {
    for (const changed of [body.replace(sha, 'b'.repeat(40)), `${body}\nextra`]) {
      expect(
        parsePreviewRequest({ author: 'github-actions[bot]', body: changed, before }),
      ).toBeUndefined();
    }
    expect(previewSha(`${before}\n対象SHA: ${sha}`)).toBeUndefined();
  });

  test('allows a repository writer to publish the requested open PR', () => {
    expect(() => {
      assertPreviewTarget(target);
    }).not.toThrow();
  });

  test('shows full URLs, a QR in the Expo Go cell and the JST deployment time', () => {
    const origin = 'https://pr-130---nuri-preview-example-an.a.run.app';
    const comment = renderPreviewComment({
      sha,
      status: '✅ 完了',
      deployment: { origin, createdAt: '2026-11-08T21:10:00Z' },
    });
    const api = `${origin}/api/recipes?offset=0`;
    expect(comment).toContain(`[${origin}/](${origin}/)`);
    expect(comment).toContain(`| 🔥 **Hono API**<br>[${api}](${api}) |`);
    expect(comment).toContain(
      `| 📱 **Expo Go**<br>\`exps://${new URL(origin).host}\`<br><img src="${origin}/expo-go/qr.svg?sha=${sha}" alt="Expo Goで開くQR" width="128"> | ✅ 完了 | 2026-11-09 06:10 |`,
    );
    expect(before).toContain('| 📱 **Expo Go**<br>— | ⚪ 未配信 | — |');
  });

  test('shows setup status without an active request when publishing is unavailable', () => {
    const pending = renderPreviewComment({ sha, canRequest: false });
    expect(pending).toContain(previewSetupPendingMarker);
    expect(pending).toContain('| 🌐 **Expo Web**<br>— | 🔧 設定待ち | — |');
    expect(pending).toContain('| 🔥 **Hono API**<br>— | 🔧 設定待ち | — |');
    expect(pending).toContain('| 📱 **Expo Go**<br>— | 🔧 設定待ち | — |');
    expect(pending).toContain('| デプロイ日時 (JST) | 💰 費用・利用枠 |');
    const apiRow = pending.split('\n').find((line) => line.startsWith('| 🔥 **Hono API**'));
    expect(apiRow).toContain('$0.00144 / vCPU・分');
    expect(apiRow).toContain('$0.00015 / GiB・分');
    expect(apiRow).toContain('$0.10 / GiB・月');
    expect(pending).toContain('**EAS消費**：Build 0件 · Workflows 0分 · Update 0 MAU');
    expect(pending).toContain('- **マージ・クローズ後**');
    expect(pending).not.toContain('<details>');
    expect(pending).not.toContain('- [ ]');
    expect(previewSha(pending)).toBe(sha);
  });

  test.each([
    { actorType: 'Bot' },
    { permission: 'read' },
    { headRepository: 'outsider/fork' },
    { headRepository: undefined },
    { state: 'closed' },
    { sha: 'b'.repeat(40) },
    { sha: 'main' },
  ])('rejects unauthorized or stale targets: %j', (patch) => {
    expect(() => {
      assertPreviewTarget({ ...target, ...patch });
    }).toThrow();
  });
});
