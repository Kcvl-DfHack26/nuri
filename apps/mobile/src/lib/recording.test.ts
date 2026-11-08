import { formatElapsed, spokenElapsed } from './recording';

test('shows the elapsed time as minutes and seconds', () => {
  expect(formatElapsed(0)).toBe('00:00');
  expect(formatElapsed(204_900)).toBe('03:24');
  expect(spokenElapsed(204_900)).toBe('3分24秒');
});
