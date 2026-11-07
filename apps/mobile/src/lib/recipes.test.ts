import { formatCount } from './recipes';

jest.mock('@/lib/api', () => ({ api: {} }));

test('formats counts like Plan A', () => {
  expect(formatCount(0)).toBe('0');
  expect(formatCount(864)).toBe('864');
  expect(formatCount(1000)).toBe('1k');
  expect(formatCount(1200)).toBe('1.2k');
  expect(formatCount(1299)).toBe('1.2k');
  expect(formatCount(3400)).toBe('3.4k');
});
