import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import boundaries from 'eslint-plugin-boundaries';
import drizzle from 'eslint-plugin-drizzle';
import hono from 'eslint-plugin-hono';
import perfectionist from 'eslint-plugin-perfectionist';
import regexp from 'eslint-plugin-regexp';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
import turbo from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

// ESLint owns only rules not covered by Oxlint's native, type-aware checks.
export default [
  {
    ignores: [
      '.agents/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/drizzle/**',
      '.artifacts/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { drizzle, hono, perfectionist, regexp, sonarjs, turbo },
    rules: {
      'perfectionist/sort-imports': ['error', { type: 'natural', order: 'asc' }],
      'regexp/no-super-linear-backtracking': 'error',
      'sonarjs/cognitive-complexity': ['error', 20],
      'turbo/no-undeclared-env-vars': 'error',
    },
  },
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/shared/src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/elements': [
        { type: 'api-module', pattern: 'apps/api/src/modules/*', capture: ['module'] },
        { type: 'api-db', pattern: 'apps/api/src/db' },
        { type: 'api-platform', pattern: 'apps/api/src/platform' },
        { type: 'api-root', pattern: 'apps/api/src' },
        { type: 'mobile-routes', pattern: 'apps/mobile/src/app' },
        { type: 'mobile-ui', pattern: 'apps/mobile/src/components' },
        { type: 'mobile-lib', pattern: 'apps/mobile/src/lib' },
        { type: 'mobile-assets', pattern: 'apps/mobile/assets' },
        // Local Expo modules with native code (e.g. the face tracker).
        { type: 'mobile-native', pattern: 'apps/mobile/modules/*' },
        { type: 'mobile-theme', pattern: 'apps/mobile/src/theme' },
        { type: 'shared', pattern: 'packages/shared/src' },
        { type: 'emulate', pattern: 'apps/emulate/src' },
      ],
      'boundaries/files': [
        { pattern: '**/*.test.{ts,tsx}', category: 'test' },
        { pattern: 'apps/mobile/src/lib/test/**', category: 'test' },
        { pattern: 'apps/mobile/global.css', category: 'mobile-style' },
        { pattern: '**/index.ts', category: 'public' },
        { pattern: 'apps/api/src/contract.ts', category: 'contract' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          checkInternals: true,
          policies: [
            {
              allow: { to: { module: { origin: ['core', 'external'] } } },
            },
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { module: { origin: ['core', 'external'] } } },
              message: 'Only explicitly approved dependencies may enter the shared package.',
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { module: { source: 'zod' } } },
            },
            {
              from: { element: { type: 'shared' }, file: { categories: 'test' } },
              allow: { to: { module: { source: 'bun:test' } } },
            },
            {
              from: { element: { type: 'api-root' } },
              allow: {
                to: { element: { type: ['api-module', 'api-db', 'api-platform', 'shared'] } },
              },
            },
            {
              from: { element: { type: 'api-module' } },
              allow: { to: { element: { type: ['api-db', 'api-platform', 'shared'] } } },
            },
            {
              from: { element: { type: 'api-module', captured: { module: 'social' } } },
              allow: { to: { element: { type: 'api-module', captured: { module: 'auth' } } } },
            },
            {
              from: { element: { type: 'api-module', captured: { module: 'recipes' } } },
              allow: { to: { element: { type: 'api-module', captured: { module: 'auth' } } } },
            },
            {
              from: { element: { type: 'api-module', captured: { module: 'recipes' } } },
              allow: { to: { element: { type: 'api-module', captured: { module: 'push' } } } },
            },
            {
              from: { element: { type: 'api-module', captured: { module: 'push' } } },
              allow: { to: { element: { type: 'api-module', captured: { module: 'auth' } } } },
            },
            {
              from: { element: { type: ['api-db', 'api-platform'] } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'mobile-routes' } },
              allow: { to: { file: { categories: 'mobile-style' } } },
            },
            {
              from: { element: { type: 'mobile-routes' } },
              allow: {
                to: {
                  element: {
                    type: ['mobile-ui', 'mobile-lib', 'mobile-theme', 'mobile-style', 'shared'],
                  },
                },
              },
            },
            {
              from: { element: { type: 'mobile-ui' } },
              allow: {
                to: {
                  element: {
                    type: [
                      'mobile-lib',
                      'mobile-theme',
                      'mobile-assets',
                      'mobile-native',
                      'shared',
                    ],
                  },
                },
              },
            },
            {
              from: { element: { type: 'mobile-lib' } },
              allow: { to: { element: { type: ['mobile-theme', 'shared'] } } },
            },
            {
              from: { element: { type: 'mobile-lib' } },
              allow: {
                to: { file: { categories: 'contract' } },
                dependency: {
                  kind: 'type',
                  nodeKind: 'import',
                  source: '@starter/api/contract',
                  specifiers: 'AppType',
                },
              },
            },
            {
              disallow: { to: { element: { type: 'api-module', fileInternalPath: '!index.ts' } } },
              message: 'Import API modules through their index.ts public entry.',
            },
            {
              allow: { dependency: { relationship: { to: 'internal' } } },
            },
            {
              from: { file: { categories: { noneOf: ['test'] } } },
              disallow: { to: { file: { categories: 'test' } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'hono/no-duplicate-routes': 'error',
      'hono/no-multiple-next': 'error',
      'hono/no-unused-context-response': 'error',
      'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['db', 'tx'] }],
      'drizzle/enforce-update-with-where': ['error', { drizzleObjectName: ['db', 'tx'] }],
    },
  },
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        cwd: `${import.meta.dirname}/apps/mobile`,
        entryPoint: 'global.css',
        selectors: [
          ...getDefaultSelectors(),
          { kind: 'attribute', name: '^\\w+ClassName$', match: [{ type: 'strings' }] },
          { kind: 'variable', name: '^\\w+ClassName$', match: [{ type: 'strings' }] },
        ],
      },
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-concatenated-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              // Match bracketed values/properties at the end, leaving selector variants alone.
              pattern: '(?:^|:)!?(?:[\\w-]+[-/])?\\[.*\\](?:/[\\w.]+)?!?$',
              message: 'Use a Tailwind utility or a named token in apps/mobile/global.css.',
            },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@starter/api/contract',
              allowImportNames: ['AppType'],
              message: 'Only AppType may cross the server boundary.',
            },
            {
              name: '@starter/api/contract',
              allowTypeImports: true,
              message: 'Import AppType with import type.',
            },
          ],
          patterns: [
            {
              group: ['../**/api/**', '@starter/api/*', '../**/infra/**', '!@starter/api/contract'],
              message: 'Use the type-only @starter/api/contract export and Hono RPC.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          globals: ['process', 'Bun'],
          checkGlobalObject: true,
        },
      ],
    },
  },
  {
    files: ['apps/mobile/**/*.test.tsx'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      'testing-library/await-async-queries': 'error',
      'testing-library/no-await-sync-queries': 'error',
    },
  },
];
