import { isSupportedPostUrl } from './sns-url';

test.each([
  'https://www.instagram.com/reel/abc123/',
  'instagram.com/reel/yuna_makeup',
  '  http://youtube.com/watch?v=abc  ',
  'https://youtu.be/abc',
  'https://m.youtube.com/shorts/abc',
  'https://www.tiktok.com/@yuna/video/1',
  'HTTPS://WWW.INSTAGRAM.COM/p/abc',
])('accepts %s', (text) => {
  expect(isSupportedPostUrl(text)).toBe(true);
});

test.each([
  '',
  'instagram.com',
  'https://www.instagram.com/',
  'https://example.com/reel/abc',
  'https://notinstagram.com/reel/abc',
  'https://instagram.com.example.com/reel/abc',
  'https://instagram.com@example.com/reel/abc',
  'ftp://instagram.com/reel/abc',
  'メイク動画',
])('rejects %s', (text) => {
  expect(isSupportedPostUrl(text)).toBe(false);
});
