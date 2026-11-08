import { recipeStepsMax } from '@starter/shared';

import {
  minSegmentMs,
  moveSegment,
  planSteps,
  segmentBounds,
  splitLastSegment,
} from './post-steps';

test('splits a recording at its marks, each step ending where the next starts', () => {
  expect(planSteps([4000, 1500], 9000)).toEqual([
    { part: 'base', startMs: 0, endMs: 1500 },
    { part: 'brow', startMs: 1500, endMs: 4000 },
    { part: 'eye', startMs: 4000, endMs: 9000 },
  ]);
});

test('makes one step of a video without marks, even when its length is unknown', () => {
  expect(planSteps([], 6100)).toEqual([{ part: 'base', startMs: 0, endMs: 6100 }]);
  expect(planSteps([], null)).toEqual([{ part: 'base', startMs: 0, endMs: null }]);
});

test('ignores marks that would make an empty step', () => {
  expect(planSteps([0, 2000, 2000, 9000, 9500], 9000)).toEqual([
    { part: 'base', startMs: 0, endMs: 2000 },
    { part: 'brow', startMs: 2000, endMs: 9000 },
  ]);
});

test('starts over from the first part after every part was used', () => {
  const marks = Array.from({ length: 8 }, (_, index) => (index + 1) * 1000);
  expect(planSteps(marks, 10_000).map((step) => step.part)).toEqual([
    'base',
    'brow',
    'eye',
    'lash',
    'cheek',
    'shading',
    'highlight',
    'lip',
    'base',
  ]);
});

test('ignores marks past the API step limit, so the last step runs to the end', () => {
  const marks = Array.from({ length: 30 }, (_, index) => (index + 1) * 1000);
  const steps = planSteps(marks, 40_000);
  expect(steps).toHaveLength(recipeStepsMax);
  expect(steps.at(-1)).toMatchObject({ startMs: (recipeStepsMax - 1) * 1000, endMs: 40_000 });
});

const steps = [
  { startMs: 0, endMs: 4000 },
  { startMs: 4000, endMs: 9000 },
  { startMs: 9000, endMs: 15_000 },
];

test('lets a step move until each neighbor keeps the shortest length', () => {
  expect(segmentBounds(steps, 1, 15_000)).toEqual({
    minStartMs: minSegmentMs,
    maxEndMs: 15_000 - minSegmentMs,
  });
  expect(segmentBounds(steps, 0, 15_000)).toEqual({ minStartMs: 0, maxEndMs: 8000 });
  expect(segmentBounds(steps, 2, 15_000)).toEqual({ minStartMs: 5000, maxEndMs: 15_000 });
  // Without the video's length, the end cannot be bounded.
  expect(segmentBounds([{ startMs: 0, endMs: null }], 0, null)).toBeNull();
});

test('moves a step and cuts its neighbors back to meet it', () => {
  expect(moveSegment(steps, 1, { startMs: 3000, endMs: 11_000 }, 15_000)).toEqual([
    { startMs: 0, endMs: 3000 },
    { startMs: 3000, endMs: 11_000 },
    { startMs: 11_000, endMs: 15_000 },
  ]);
  // Shrinking a step leaves the neighbors as they are; the freed time belongs to no step.
  expect(moveSegment(steps, 1, { startMs: 5000, endMs: 8000 }, 15_000)).toEqual([
    { startMs: 0, endMs: 4000 },
    { startMs: 5000, endMs: 8000 },
    { startMs: 9000, endMs: 15_000 },
  ]);
});

test('keeps every step at least the shortest length', () => {
  const moved = moveSegment(steps, 1, { startMs: 0, endMs: 15_000 }, 15_000);
  expect(moved).toEqual([
    { startMs: 0, endMs: minSegmentMs },
    { startMs: minSegmentMs, endMs: 14_000 },
    { startMs: 14_000, endMs: 15_000 },
  ]);
  expect(moveSegment(steps, 1, { startMs: 6000, endMs: 6000 }, 15_000)[1]).toEqual({
    startMs: 6000,
    endMs: 6000 + minSegmentMs,
  });
});

test('keeps a gap the analysis left between steps', () => {
  const gapped = [
    { startMs: 0, endMs: 3000 },
    { startMs: 5000, endMs: 9000 },
  ];
  expect(moveSegment(gapped, 1, { startMs: 4000, endMs: 9000 }, 12_000)).toEqual([
    { startMs: 0, endMs: 3000 },
    { startMs: 4000, endMs: 9000 },
  ]);
});

test('splits the last step at its middle to add one', () => {
  expect(splitLastSegment(steps)).toEqual([
    { startMs: 9000, endMs: 12_000 },
    { startMs: 12_000, endMs: 15_000 },
  ]);
});

test('adds no step that would be too short, past the limit, or of unknown length', () => {
  expect(splitLastSegment([{ startMs: 0, endMs: minSegmentMs * 2 - 1 }])).toBeNull();
  expect(splitLastSegment([{ startMs: 0, endMs: null }])).toBeNull();
  expect(splitLastSegment([])).toBeNull();
  const full = Array.from({ length: recipeStepsMax }, (_, index) => ({
    startMs: index * 5000,
    endMs: (index + 1) * 5000,
  }));
  expect(splitLastSegment(full)).toBeNull();
});
