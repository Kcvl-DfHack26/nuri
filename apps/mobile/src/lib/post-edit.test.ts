import { addTag, lastFrameTime, normalizeTag } from './post-edit';

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
});

test('defaults the thumbnail to just before the end of the video', () => {
  expect(lastFrameTime(6100)).toBe(6000);
  expect(lastFrameTime(null)).toBe(0);
  expect(lastFrameTime(50)).toBe(0);
});
