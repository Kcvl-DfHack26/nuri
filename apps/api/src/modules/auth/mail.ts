import type { Environment } from '../../platform/env';

export async function sendLoginEmail(env: Environment, email: string, url: string) {
  const verification = new URL(url);
  const callback = verification.searchParams.get('callbackURL');
  // Native apps verify through the same Better Auth handler via a JSON response
  // so the Expo plugin can persist Set-Cookie without a browser redirect.
  if (callback && !callback.startsWith('https:') && !callback.startsWith('http:')) {
    const link = new URL(callback);
    link.searchParams.set('token', verification.searchParams.get('token') ?? '');
    url = link.toString();
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
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error('Login email could not be delivered');
  }
}
