import type { MiddlewareHandler } from 'hono';

import { postAnalysisSchema } from '@starter/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import type { PostAnalyzer } from './gemini';

const marksSchema = z
  .string()
  .default('')
  .transform((value) => (value.trim() ? value.split(',').map(Number) : []))
  .pipe(z.array(z.number().min(0).max(3600)).max(19));

/**
 * POST /post-analyses reads a video from ⑫-3 with Gemini (#46). The video stays in memory and is
 * never saved. Without Vertex AI (local development, CI) `analyze` is null and the route answers
 * 503, so the app falls back to the steps it makes from the marks. `requireUser` is the session
 * check (requireSession), passed in so this module does not depend on auth.
 */
export function postAnalysisRoutes(requireUser: MiddlewareHandler, analyze: PostAnalyzer | null) {
  return new Hono().post('/post-analyses', requireUser, async (c) => {
    if (!analyze) {
      return c.json({ error: 'analysis_unavailable' as const }, 503);
    }
    const form = await c.req.formData().catch(() => null);
    const video = form?.get('video');
    const marks = marksSchema.safeParse(form?.get('marks') ?? undefined);
    if (!(video instanceof File) || !video.type.startsWith('video/') || !marks.success) {
      return c.json({ error: 'invalid_video' as const }, 400);
    }
    try {
      const analysis = await analyze({
        data: new Uint8Array(await video.arrayBuffer()),
        mimeType: video.type,
        marks: marks.data,
      });
      return c.json(postAnalysisSchema.parse(analysis));
    } catch (error) {
      // Gemini failed or answered outside the schema; the app keeps the steps from the marks.
      // Log only the reason, never the video or the answer, which can describe the user.
      const status =
        typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
      console.error(
        'Post analysis failed:',
        error instanceof Error ? error.name : 'unknown',
        status,
      );
      return c.json({ error: 'analysis_failed' as const }, 502);
    }
  });
}
