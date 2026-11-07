import { makeupParts } from '@starter/shared';

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
 * step is empty. Parts follow ②'s order until something better can suggest them.
 */
export function planSteps(marks: readonly number[], durationMs: number | null): PlannedStep[] {
  const starts = [0];
  for (const mark of [...marks].sort((a, b) => a - b)) {
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
