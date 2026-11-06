import { formatPostDate } from './date';

const now = new Date('2026-11-06T12:00:00Z').getTime();
test.each([
  ['2026-11-06T12:01:00Z', 'たった今'],
  ['2026-11-06T11:59:30Z', 'たった今'],
  ['2026-11-06T11:55:00Z', '5分前'],
  ['2026-11-06T10:00:00Z', '2時間前'],
  ['2026-11-04T03:00:00Z', '11月4日'],
  ['2025-11-04T03:00:00Z', '2025年11月4日'],
])('formats %s at a consistent level of detail', (date, expected) => {
  expect(formatPostDate(date, now).short).toBe(expected);
  expect(formatPostDate(date, now).full).toContain('年');
});
