import { recipeTagsMax } from '@starter/shared';

/** A tag as typed on ⑫-7, shown with one leading #; null when nothing remains to add. */
export function normalizeTag(input: string) {
  const body = input
    .trim()
    .replace(/^[#＃\s]+/u, '')
    .trim();
  return body ? `#${body}` : null;
}

/** Adds a typed tag once; returns the same list when it is empty, already there or full. */
export function addTag(tags: string[], input: string) {
  const tag = normalizeTag(input);
  return tag && !tags.includes(tag) && tags.length < recipeTagsMax ? [...tags, tag] : tags;
}

/** Stay just before the end, where some videos have no decodable frame. */
const endMargin = 100;

/** The default thumbnail: the video's last frame, or its first when the length is unknown. */
export function lastFrameTime(durationMs: number | null) {
  return durationMs && durationMs > endMargin ? durationMs - endMargin : 0;
}

/** m:ss of a time in the video, e.g. 1:05. */
export function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The recipe's 〜分 from the video's length, at least one minute; one when the length is unknown. */
export function recipeMinutes(durationMs: number | null) {
  return Math.max(1, Math.ceil((durationMs ?? 0) / 60_000));
}
