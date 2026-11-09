import { recipeStepsMax } from '@starter/shared';

import { minSegmentMs, moveSegment, planSteps, segmentBounds, insertSegment } from './post-steps';

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

test('adds a step over the picked time, cutting back the steps it overlaps', () => {
  expect(insertSegment(steps, { startMs: 3000, endMs: 6000 }, 15_000)).toEqual({
    segments: [
      { startMs: 0, endMs: 3000 },
      { startMs: 3000, endMs: 6000 },
      { startMs: 6000, endMs: 9000 },
      { startMs: 9000, endMs: 15_000 },
    ],
    index: 1,
  });
  // Inside one step, that step keeps the part before it; the rest is left to no step.
  expect(insertSegment(steps, { startMs: 10_000, endMs: 12_000 }, 15_000)).toEqual({
    segments: [
      { startMs: 0, endMs: 4000 },
      { startMs: 4000, endMs: 9000 },
      { startMs: 9000, endMs: 10_000 },
      { startMs: 10_000, endMs: 12_000 },
    ],
    index: 3,
  });
});

test('adds a step in a gap the analysis left without touching the others', () => {
  const gapped = [
    { startMs: 2000, endMs: 4000 },
    { startMs: 8000, endMs: 9000 },
  ];
  expect(insertSegment(gapped, { startMs: 5000, endMs: 7000 }, 12_000)).toEqual({
    segments: [gapped[0], { startMs: 5000, endMs: 7000 }, gapped[1]],
    index: 1,
  });
  expect(insertSegment(gapped, { startMs: 0, endMs: 1500 }, 12_000)?.index).toBe(0);
});

test('adds no step that covers a step, leaves one too short, or does not fit', () => {
  // Covers the whole second step.
  expect(insertSegment(steps, { startMs: 3000, endMs: 10_000 }, 15_000)).toBeNull();
  // Leaves half a second of the first step.
  expect(insertSegment(steps, { startMs: 500, endMs: 2000 }, 15_000)).toBeNull();
  expect(insertSegment(steps, { startMs: 5000, endMs: 5500 }, 15_000)).toBeNull();
  expect(insertSegment(steps, { startMs: 14_000, endMs: 16_000 }, 15_000)).toBeNull();
  expect(
    insertSegment([{ startMs: 0, endMs: null }], { startMs: 0, endMs: 2000 }, null),
  ).toBeNull();
  const full = Array.from({ length: recipeStepsMax }, (_, index) => ({
    startMs: index * 5000,
    endMs: (index + 1) * 5000,
  }));
  expect(insertSegment(full, { startMs: 1000, endMs: 3000 }, recipeStepsMax * 5000)).toBeNull();
});
