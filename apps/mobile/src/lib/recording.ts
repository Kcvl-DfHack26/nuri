/** ⑫-2's timer, e.g. 03:24 for 204 seconds. */
export function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The timer as read aloud, e.g. 3分24秒. */
export function spokenElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

/**
 * Lengths of the steps split by 手順を区切る, in recording order. The last one is the step being
 * recorded and grows with the timer.
 */
export function stepLengths(marks: number[], elapsed: number) {
  const bounds = [0, ...marks, Math.max(elapsed, marks.at(-1) ?? 0)];
  return bounds.slice(1).map((end, index) => end - (bounds[index] ?? 0));
}
