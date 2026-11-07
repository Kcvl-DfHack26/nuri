import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configureDebugTrust } from '../apps/mobile/plugins/with-localhost-ca';

test('adds local CA trust only to debug and preserves existing manifest settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'starter-android-trust-'));
  const main = '<manifest><application /></manifest>';
  try {
    await mkdir(join(root, 'app/src/main'), { recursive: true });
    await mkdir(join(root, 'app/src/debug'), { recursive: true });
    await writeFile(join(root, 'app/src/main/AndroidManifest.xml'), main);
    await writeFile(
      join(root, 'app/src/debug/AndroidManifest.xml'),
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:usesCleartextTraffic="true" /></manifest>',
    );
    await configureDebugTrust(root);
    await configureDebugTrust(root);
    expect(await readFile(join(root, 'app/src/main/AndroidManifest.xml'), 'utf8')).toBe(main);
    const debug = await readFile(join(root, 'app/src/debug/AndroidManifest.xml'), 'utf8');
    expect(debug).toContain('android:usesCleartextTraffic="true"');
    expect(debug.match(/android:networkSecurityConfig=/g)).toHaveLength(1);
    const xml = await readFile(
      join(root, 'app/src/debug/res/xml/nuri_network_security_config.xml'),
      'utf8',
    );
    expect(xml).toContain('<domain includeSubdomains="true">localhost</domain>');
    expect(xml).toContain('<certificates src="user" />');
    expect(xml).toContain(
      '<base-config cleartextTrafficPermitted="true"><trust-anchors><certificates src="system" /></trust-anchors></base-config>',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
