import type { ConfigPlugin } from 'expo/config-plugins';

import { AndroidConfig, withDangerousMod } from 'expo/config-plugins';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Only the debug source set trusts user-installed CAs, and only for .localhost.
// Release/preview manifests and system-wide trust are not modified.
export async function configureDebugTrust(androidRoot: string) {
  const debugRoot = join(androidRoot, 'app/src/debug');
  const manifestPath = join(debugRoot, 'AndroidManifest.xml');
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  const application = manifest.manifest.application?.[0];
  if (!application) {
    throw new Error('Missing Android debug application manifest');
  }
  application.$['android:networkSecurityConfig'] = '@xml/nuri_network_security_config';
  await mkdir(join(debugRoot, 'res/xml'), { recursive: true });
  await writeFile(
    join(debugRoot, 'res/xml/nuri_network_security_config.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="${application.$['android:usesCleartextTraffic'] === 'true'}"><trust-anchors><certificates src="system" /></trust-anchors></base-config>
  <domain-config>
    <domain includeSubdomains="true">localhost</domain>
    <trust-anchors><certificates src="system" /><certificates src="user" /></trust-anchors>
  </domain-config>
</network-security-config>
`,
  );
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
}

const withLocalhostCA: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (mod) => {
      await configureDebugTrust(mod.modRequest.platformProjectRoot);
      return mod;
    },
  ]);

export default withLocalhostCA;
