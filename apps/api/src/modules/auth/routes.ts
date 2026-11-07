import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Auth } from './service';

const openMobileLinkScript = `
  try {
    const value = new URLSearchParams(location.hash.slice(1)).get('callback');
    const link = new URL(value);
    if (
      !['com.kcvl.nuri:', 'exp:', 'exps:'].includes(link.protocol) ||
      !link.pathname.endsWith('/auth-callback') ||
      !link.searchParams.get('token') ||
      !link.searchParams.get('state')
    ) throw new Error('invalid link');
    document.getElementById('open').href = link.href;
  } catch {
    document.getElementById('open').remove();
    document.getElementById('error').hidden = false;
  }
`;

export function authRoutes(auth: Auth, baseURL: string) {
  return new Hono()
    .get('/open-mobile-link', (c) => {
      const nonce = crypto.randomUUID().replaceAll('-', '');
      c.header('Referrer-Policy', 'no-referrer');
      c.header(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'`,
      );
      return c.html(`<!doctype html>
<html lang="ja">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>nuriにログイン</title>
<style nonce="${nonce}">body{font-family:system-ui,sans-serif;padding:16px}a{display:inline-block;min-height:48px;line-height:48px;padding:0 16px;font-size:18px}</style>
<body>
  <h1>nuriにログイン</h1>
  <p>この端末でnuriアプリを開いてください。</p>
  <p><a id="open">nuriアプリで開く</a></p>
  <p id="error" hidden>リンクが無効です。nuriからもう一度メールを送ってください。</p>
  <script nonce="${nonce}">${openMobileLinkScript}</script>
</body>
</html>`);
    })
    .post(
      '/mobile-magic-link',
      zValidator('json', z.object({ token: z.string().min(1).max(256) })),
      async (c) => {
        const url = new URL('/api/auth/magic-link/verify', baseURL);
        url.searchParams.set('token', c.req.valid('json').token);
        url.searchParams.set('callbackURL', baseURL);
        const response = await auth.handler(new Request(url, { headers: c.req.raw.headers }));
        if (
          response.status !== 302 ||
          new URL(response.headers.get('location') ?? baseURL).searchParams.has('error')
        ) {
          return c.json({ error: 'invalid_or_expired_link' as const }, 400);
        }
        for (const cookie of response.headers.getSetCookie()) {
          c.header('Set-Cookie', cookie, { append: true });
        }
        return c.json({ success: true });
      },
    )
    .on(['GET', 'POST'], '/*', (c) => auth.handler(c.req.raw));
}
