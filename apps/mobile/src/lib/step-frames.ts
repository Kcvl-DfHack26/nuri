// How far before a segment's end its last frame is tried, so the frame still shows that step.
const endMarginMs = 300;

/**
 * The times a step's frame is tried at, in order (#224): the start of its segment, the middle and
 * just before the end, so a face hidden by a brush or a hand at the start can still be found.
 */
export function frameTimes({
  startMs,
  endMs,
}: {
  startMs: number;
  endMs: number | null;
}): number[] {
  if (endMs === null || endMs <= startMs) {
    return [startMs];
  }
  const times = [
    startMs,
    Math.round((startMs + endMs) / 2),
    Math.max(startMs, endMs - endMarginMs),
  ];
  return [...new Set(times)];
}

/** The other steps' positions, the one starting nearest in time to `position`'s first (#224). */
export function nearestSteps(starts: readonly number[], position: number): number[] {
  const own = starts[position] ?? 0;
  return starts
    .map((start, index) => ({ index, gap: Math.abs(start - own) }))
    .filter(({ index }) => index !== position)
    .sort((a, b) => a.gap - b.gap || a.index - b.index)
    .map(({ index }) => index);
}
