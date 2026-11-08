import { makeupParts, recipeStepsMax } from '@starter/shared';

type PartId = (typeof makeupParts)[number];

/** A step ⑫-3 makes from the video before the user edits it on ⑫-5. */
export type PlannedStep = {
  /** The first guess of the step's part; the user picks the real one on ⑫-5. */
  part: PartId;
  /** Where the step starts in the video, in ms. */
  startMs: number;
  /** Where it ends: the next step's start or the video's end; null when the length is unknown. */
  endMs: number | null;
};

/**
 * ⑫-3: splits the video into steps at the marks of 手順を区切る. A video without marks, such as one
 * chosen with 動画から, is one step. Marks outside the video and repeated marks are ignored, so no
 * step is empty; marks past the API's step limit are ignored. Parts follow ②'s order until something better can suggest them.
 */
export function planSteps(marks: readonly number[], durationMs: number | null): PlannedStep[] {
  const starts = [0];
  for (const mark of [...marks].sort((a, b) => a - b)) {
    if (starts.length >= recipeStepsMax) {
      break;
    }
    if (mark > (starts.at(-1) ?? 0) && (durationMs === null || mark < durationMs)) {
      starts.push(mark);
    }
  }
  return starts.map((startMs, index) => ({
    part: makeupParts[index % makeupParts.length] ?? 'base',
    startMs,
    endMs: starts[index + 1] ?? durationMs,
  }));
}

/** A step's place in the video, in ms; `endMs` is null when the video's length is unknown. */
export type Segment = { startMs: number; endMs: number | null };

/** The shortest step ⑫-5 lets a segment become. */
export const minSegmentMs = 1000;

/**
 * ⑫-5: how far a step's start and end may move. The start may go back until the previous step
 * keeps `minSegmentMs`, or to the video's start; the end may go on until the next step keeps it,
 * or to the video's end. Null when the video's length is unknown, so the end cannot be bounded.
 */
export function segmentBounds(
  segments: readonly Segment[],
  index: number,
  durationMs: number | null,
): { minStartMs: number; maxEndMs: number } | null {
  const previous = segments[index - 1];
  const next = segments[index + 1];
  const nextEnd = next ? (next.endMs ?? durationMs) : durationMs;
  if (nextEnd === null || !segments[index]) {
    return null;
  }
  return {
    minStartMs: previous ? previous.startMs + minSegmentMs : 0,
    maxEndMs: next ? nextEnd - minSegmentMs : nextEnd,
  };
}

/**
 * ⑫-5: the segments after a step is moved to `startMs`–`endMs`, kept inside `segmentBounds` and at
 * least `minSegmentMs` long. A neighbor that would overlap is cut back to meet it; a gap the
 * analysis left between steps stays.
 */
export function moveSegment(
  segments: readonly Segment[],
  index: number,
  change: { startMs: number; endMs: number },
  durationMs: number | null,
): Segment[] {
  const bounds = segmentBounds(segments, index, durationMs);
  if (!bounds) {
    return [...segments];
  }
  const startMs = Math.min(
    Math.max(change.startMs, bounds.minStartMs),
    bounds.maxEndMs - minSegmentMs,
  );
  const endMs = Math.max(Math.min(change.endMs, bounds.maxEndMs), startMs + minSegmentMs);
  return segments.map((segment, position) => {
    if (position === index) {
      return { startMs, endMs };
    }
    if (position === index - 1 && (segment.endMs === null || segment.endMs > startMs)) {
      return { ...segment, endMs: startMs };
    }
    if (position === index + 1 && segment.startMs < endMs) {
      return { ...segment, startMs: endMs };
    }
    return segment;
  });
}

/**
 * ⑫-4 (#186): 手順を追加 with the start and end the user picked. The new step takes that time; a
 * step it overlaps is cut back to meet it, and a step it falls inside keeps the part before it.
 * Returns the segments with the new one and its index, or null when the new step is shorter than
 * `minSegmentMs`, would cover a whole step or leave one shorter than it, would pass
 * `recipeStepsMax`, or lies outside the video.
 */
export function insertSegment(
  segments: readonly Segment[],
  range: { startMs: number; endMs: number },
  durationMs: number | null,
): { segments: Segment[]; index: number } | null {
  const { startMs, endMs } = range;
  if (
    durationMs === null ||
    segments.length >= recipeStepsMax ||
    startMs < 0 ||
    endMs > durationMs ||
    endMs - startMs < minSegmentMs
  ) {
    return null;
  }
  const kept: Segment[] = [];
  for (const segment of segments) {
    const end = segment.endMs ?? durationMs;
    if (end <= startMs || segment.startMs >= endMs) {
      kept.push(segment);
      continue;
    }
    if (segment.startMs >= startMs && end <= endMs) {
      return null;
    }
    const trimmed =
      segment.startMs < startMs ? { ...segment, endMs: startMs } : { ...segment, startMs: endMs };
    if ((trimmed.endMs ?? durationMs) - trimmed.startMs < minSegmentMs) {
      return null;
    }
    kept.push(trimmed);
  }
  const index = kept.filter((segment) => segment.startMs < startMs).length;
  return {
    segments: [...kept.slice(0, index), { startMs, endMs }, ...kept.slice(index)],
    index,
  };
}
