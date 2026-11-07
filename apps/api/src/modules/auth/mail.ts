import type { Environment } from '../../platform/env';

export async function sendLoginEmail(env: Environment, email: string, url: string) {
  const verification = new URL(url);
  const callback = verification.searchParams.get('callbackURL');
  // Mail clients do not reliably link custom schemes, so open an HTTPS page first.
  // The app still verifies the token itself and lets the Expo plugin persist Set-Cookie.
  if (callback && !callback.startsWith('https:') && !callback.startsWith('http:')) {
    const link = new URL(callback);
    link.searchParams.set('token', verification.searchParams.get('token') ?? '');
    const open = new URL('/api/auth/open-mobile-link', env.BETTER_AUTH_URL);
    // Fragments stay in the browser: Cloud Run request logs never receive the token.
    open.hash = new URLSearchParams({ callback: link.toString() }).toString();
    url = open.toString();
  }
  const response = await fetch(`${env.RESEND_API_URL}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AUTH_EMULATE ? 're_local_sample' : env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'ログイン用リンクのお届け',
      text: `以下のリンクからログインしてください。10分間有効で、1度だけ使えます。\n\n${url}\n\n心当たりがない場合は、このメールを破棄してください。`,
      html: `<p>以下のリンクからログインしてください。10分間有効で、1度だけ使えます。</p><p><a href="${url.replaceAll('&', '&amp;')}">nuriを開いてログインする</a></p><p>心当たりがない場合は、このメールを破棄してください。</p>`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error('Login email could not be delivered');
  }
}
