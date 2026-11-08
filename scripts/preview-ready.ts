import { setTimeout } from 'node:timers/promises';

const deadline = Date.now() + 90_000;

async function waitFor(url: string) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
    } catch {
      // ポートが開くまでの接続拒否やタイムアウトは再試行する。
    }
    await setTimeout(500);
  }
  throw new Error(`Preview startup timed out waiting for ${url}`);
}

await Promise.all([
  waitFor('http://127.0.0.1:8081/ready'),
  waitFor('http://127.0.0.1:8082/status'),
]);
