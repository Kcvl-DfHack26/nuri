import { addTag, formatClock, lastFrameTime, normalizeTag, recipeMinutes } from './post-edit';

test('keeps one leading # on a typed tag', () => {
  expect(normalizeTag('丸顔')).toBe('#丸顔');
  expect(normalizeTag('  ##丸顔 ')).toBe('#丸顔');
  expect(normalizeTag('＃丸顔')).toBe('#丸顔');
  expect(normalizeTag(' # ')).toBeNull();
});

test('adds a tag once', () => {
  expect(addTag(['#丸顔'], '15分')).toEqual(['#丸顔', '#15分']);
  expect(addTag(['#丸顔'], '丸顔')).toEqual(['#丸顔']);
  expect(addTag(['#丸顔'], '  ')).toEqual(['#丸顔']);
  const full = Array.from({ length: 10 }, (_, index) => `#${index}`);
  expect(addTag(full, '丸顔')).toBe(full);
});

test('defaults the thumbnail to just before the end of the video', () => {
  expect(lastFrameTime(6100)).toBe(6000);
  expect(lastFrameTime(null)).toBe(0);
  expect(lastFrameTime(50)).toBe(0);
});

test('shows video times as m:ss and rounds the recipe up to whole minutes', () => {
  expect(formatClock(65_400)).toBe('1:05');
  expect(formatClock(0)).toBe('0:00');
  expect(recipeMinutes(61_000)).toBe(2);
  expect(recipeMinutes(5000)).toBe(1);
  expect(recipeMinutes(null)).toBe(1);
});
