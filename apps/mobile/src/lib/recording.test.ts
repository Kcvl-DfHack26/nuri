import { formatElapsed, spokenElapsed, stepLengths } from './recording';

test('shows the elapsed time as minutes and seconds', () => {
  expect(formatElapsed(0)).toBe('00:00');
  expect(formatElapsed(204_900)).toBe('03:24');
  expect(spokenElapsed(204_900)).toBe('3分24秒');
});

test('splits the recording into steps at each mark', () => {
  expect(stepLengths([], 5000)).toEqual([5000]);
  expect(stepLengths([1000, 4000], 6000)).toEqual([1000, 3000, 2000]);
});

test('keeps the current step from going negative right after a mark', () => {
  expect(stepLengths([3000], 2990)).toEqual([3000, 0]);
});
