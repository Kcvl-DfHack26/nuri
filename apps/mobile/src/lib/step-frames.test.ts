import { frameTimes, nearestSteps } from './step-frames';

test('tries the start, the middle and just before the end of a segment', () => {
  expect(frameTimes({ startMs: 10_000, endMs: 20_000 })).toEqual([10_000, 15_000, 19_700]);
  // A very short segment does not try the same time twice or go before its start.
  expect(frameTimes({ startMs: 1000, endMs: 1200 })).toEqual([1000, 1100]);
  // Without a known end, only the start is tried.
  expect(frameTimes({ startMs: 5000, endMs: null })).toEqual([5000]);
});

test('orders the other steps by how near they start', () => {
  expect(nearestSteps([0, 10_000, 30_000, 34_000], 2)).toEqual([3, 1, 0]);
  // On a tie, the earlier step comes first.
  expect(nearestSteps([0, 10_000, 20_000], 1)).toEqual([0, 2]);
  expect(nearestSteps([0], 0)).toEqual([]);
});
