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
];
for (const example of cases) {
  test(`${example.valid ? 'allows' : 'rejects'} ${example.file}: ${example.code}`, async () => {
    const results = await eslint.lintText(example.code, { filePath: example.file });
    const errors = results
      .flatMap((result) => result.messages)
      .filter(
        (message) =>
          (message.ruleId ?? '').startsWith('boundaries/') ||
          message.ruleId === 'no-restricted-imports',
      );
    expect(errors.length === 0).toBe(example.valid);
  });
}
