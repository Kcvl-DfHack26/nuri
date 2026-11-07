import { recipeStepsMax } from '@starter/shared';

import { planSteps } from './post-steps';

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
