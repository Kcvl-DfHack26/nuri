import { describe, expect, test } from 'bun:test';

import {
  assertPreviewTarget,
  parsePreviewRequest,
  previewSha,
  renderPreviewComment,
} from './preview-comment';

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

  test('links the same preview origin for Web, the API and Expo Go', () => {
    const origin = 'https://pr-130---nuri-preview-example-an.a.run.app';
    const comment = renderPreviewComment({ sha, origin });
    expect(comment).toContain(`[Expo Web](${origin}/)`);
    expect(comment).toContain(`${origin}/api/recipes?offset=0`);
    expect(comment).toContain('exps://pr-130---nuri-preview-example-an.a.run.app');
    expect(comment).toContain(`${origin}/expo-go/qr.svg?sha=${sha}`);
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
