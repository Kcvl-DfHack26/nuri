/** A tag as typed on ⑫-7, shown with one leading #; null when nothing remains to add. */
export function normalizeTag(input: string) {
  const body = input
    .trim()
    .replace(/^[#＃\s]+/u, '')
    .trim();
  return body ? `#${body}` : null;
}

/** Adds a typed tag once; returns the same list when it is empty or already there. */
export function addTag(tags: string[], input: string) {
  const tag = normalizeTag(input);
  return tag && !tags.includes(tag) ? [...tags, tag] : tags;
}

/** Stay just before the end, where some videos have no decodable frame. */
const endMargin = 100;

/** The default thumbnail: the video's last frame, or its first when the length is unknown. */
export function lastFrameTime(durationMs: number | null) {
  return durationMs && durationMs > endMargin ? durationMs - endMargin : 0;
}
