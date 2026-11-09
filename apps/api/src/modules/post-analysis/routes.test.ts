import type { PostAnalysis } from '@starter/shared';

import { describe, expect, spyOn, test } from 'bun:test';
import { createMiddleware } from 'hono/factory';

import type { PostAnalyzer, PostVideo } from './gemini';

import { postAnalysisRoutes } from './routes';

// Lets every request through, so these tests cover the route; app.test.ts covers the session check.
const signedIn = createMiddleware(async (_c, next) => {
  await next();
});

const analysis: PostAnalysis = {
  title: 'ナチュラルメイク',
  summary: '眉とリップのメイク',
  steps: [
    {
      start: 4,
      end: 18,
      part: 'brow',
      description: '眉尻を描き足す',
      color: '#5A3D2B',
      regions: [
        {
          detail: '眉山から眉尻',
          side: 'screenRight',
          start: 'browPeak',
          end: 'browTail',
          shape: 'line',
          length: 'none',
          direction: 'none',
          clip: 'brow',
        },
      ],
      cosmetics: [0],
    },
  ],
  cosmetics: [
    {
      brand: 'peripera',
      name: 'スピーディー スキニー ブロウ',
      category: 'アイブロウペンシル',
      confidence: 'high',
      verified: true,
      sources: [{ title: 'cosme.com', url: 'https://example.com/brow' }],
    },
  ],
};

function form(fields: Record<string, string | Blob>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  return { method: 'POST', body };
}
const video = () => new File([new Uint8Array([0, 1, 2])], 'make.mp4', { type: 'video/mp4' });

describe('POST /post-analyses', () => {
  test('answers 503 without Vertex AI so the app keeps the steps from its marks', async () => {
    const app = postAnalysisRoutes(signedIn, null);
    const response = await app.request('/post-analyses', form({ video: video() }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'analysis_unavailable' });
  });

  test('passes the video and marks once and returns the checked analysis', async () => {
    const calls: PostVideo[] = [];
    const analyze: PostAnalyzer = (input) => {
      calls.push(input);
      return Promise.resolve(analysis);
    };
    const app = postAnalysisRoutes(signedIn, analyze);
    const response = await app.request(
      '/post-analyses',
      form({ video: video(), marks: '26,62.5' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(analysis);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.mimeType).toBe('video/mp4');
    expect(calls[0]?.marks).toEqual([26, 62.5]);
    expect([...(calls[0]?.data ?? [])]).toEqual([0, 1, 2]);
  });

  test.each([
    ['no video', { marks: '1' }],
    ['a file that is not a video', { video: new File(['x'], 'a.txt', { type: 'text/plain' }) }],
    ['marks that are not times', { video: video(), marks: 'a,b' }],
    ['a negative mark', { video: video(), marks: '-1' }],
  ])('rejects %s before calling Gemini', async (_name, fields) => {
    let called = false;
    const app = postAnalysisRoutes(signedIn, () => {
      called = true;
      return Promise.resolve(analysis);
    });
    const response = await app.request('/post-analyses', form(fields));
    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  test.each<[string, PostAnalyzer]>([
    ['fails', () => Promise.reject(new Error('503 high demand'))],
    // A title longer than 40 characters is outside postAnalysisSchema.
    ['answers outside the schema', () => Promise.resolve({ ...analysis, title: 'あ'.repeat(41) })],
  ])('answers 502 when Gemini %s and logs only the reason', async (_name, analyze) => {
    const log = spyOn(console, 'error').mockImplementation(() => undefined);
    const app = postAnalysisRoutes(signedIn, analyze);
    const response = await app.request('/post-analyses', form({ video: video() }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'analysis_failed' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain('ナチュラルメイク');
    log.mockRestore();
  });
});
