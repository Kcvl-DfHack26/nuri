import type { PostAnalysis } from '@starter/shared';

import { postAnalysisSchema, postAnalysisVideoMaxBytes } from '@starter/shared';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { api, authClient } from '@/lib/api';

const failures: Record<number, string> = {
  401: 'ログインし直してからお試しください。',
  413: '動画が大きすぎるため、送れませんでした。',
  503: '今は動画から手順書を作れません。',
};

/**
 * ⑫-3: sends the video and the marks (ms) to the API, which reads them with Gemini (#142). The
 * error's message is shown before ⑫-3 falls back to the steps made from the marks alone.
 */
export async function analyzePostVideo(
  video: { uri: string; marks: readonly number[] },
  signal: AbortSignal,
): Promise<PostAnalysis> {
  const file = new File(video.uri);
  if (file.size > postAnalysisVideoMaxBytes) {
    throw new Error(failures[413]);
  }
  const form = new FormData();
  // expo/fetch reads the file's bytes from disk; the video is not loaded into JS first.
  form.append('video', file);
  form.append('marks', video.marks.map((mark) => (mark / 1000).toFixed(1)).join(','));
  let response;
  try {
    response = await fetch(api.api['post-analyses'].$url().toString(), {
      method: 'POST',
      body: form,
      signal,
      headers: Platform.OS === 'web' ? {} : { cookie: await authClient.getCookie() },
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new Error('通信状況を確認してお試しください。');
  }
  if (response.ok) {
    return postAnalysisSchema.parse(await response.json());
  }
  throw new Error(failures[response.status] ?? '動画から手順書を作れませんでした。');
}
