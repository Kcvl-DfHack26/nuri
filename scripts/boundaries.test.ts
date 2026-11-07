import { expect, test } from 'bun:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: import.meta.dirname + '/..' });
const cases = [
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "import type { AppType } from '@starter/api/contract';",
    valid: true,
  },
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "import { createApp } from '../../../api/src/app';",
    valid: false,
  },
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "import { AppType } from '@starter/api/contract';",
    valid: false,
  },
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "import type { AppType, PrivateType } from '@starter/api/contract';",
    valid: false,
  },
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "import type { AppType } from '../../../api/src/contract';",
    valid: false,
  },
  {
    file: 'apps/api/src/modules/auth/service.ts',
    code: "import { sendLoginEmail } from './mail';",
    valid: true,
  },
  {
    file: 'apps/api/src/modules/social/routes.ts',
    code: "import { requireSession } from '../auth';",
    valid: true,
  },
  {
    file: 'apps/api/src/modules/social/routes.ts',
    code: "import { createAuth } from '../auth/service';",
    valid: false,
  },
  {
    file: 'apps/api/src/modules/auth/service.ts',
    code: "import { socialRoutes } from '../social';",
    valid: false,
  },
  {
    file: 'apps/api/src/db/client.ts',
    code: "import { createAuth } from '../modules/auth';",
    valid: false,
  },
  {
    file: 'apps/mobile/src/components/feed.tsx',
    code: "import Screen from '@/app/account';",
    valid: false,
  },
  {
    file: 'apps/mobile/src/lib/api.ts',
    code: "export { Account } from '@/components/account';",
    valid: false,
  },
  {
    file: 'packages/shared/src/index.ts',
    code: "import { View } from 'react-native';",
    valid: false,
  },
  {
    file: 'packages/shared/src/index.ts',
    code: "await import('node:fs');",
    valid: false,
  },
  {
    file: 'packages/shared/src/index.ts',
    code: 'const url = process.env.DATABASE_URL;',
    valid: false,
  },
  {
    file: 'packages/shared/src/index.ts',
    code: "import './index.test';",
    valid: false,
  },
  {
    file: 'packages/shared/src/index.ts',
    code: "import { z } from 'zod';",
    valid: true,
  },
  {
    file: 'packages/shared/src/index.test.ts',
    code: "import { expect } from 'bun:test';",
    valid: true,
  },
];
for (const example of cases) {
  test(`${example.valid ? 'allows' : 'rejects'} ${example.file}: ${example.code}`, async () => {
    const results = await eslint.lintText(example.code, { filePath: example.file });
    expect(results[0]?.fatalErrorCount).toBe(0);
    const errors = results
      .flatMap((result) => result.messages)
      .filter(
        (message) =>
          (message.ruleId ?? '').startsWith('boundaries/') ||
          message.ruleId === 'no-restricted-imports' ||
          message.ruleId === 'no-restricted-globals',
      );
    if (example.valid) {
      expect(errors).toHaveLength(0);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });
}
