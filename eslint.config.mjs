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
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'hono/no-duplicate-routes': 'error',
      'hono/no-multiple-next': 'error',
      'hono/no-unused-context-response': 'error',
      'drizzle/enforce-delete-with-where': 'error',
      'drizzle/enforce-update-with-where': 'error',
    },
  },
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@starter/api/contract',
              allowTypeImports: true,
              message: 'Only AppType may cross the server boundary.',
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
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/apps/**',
            '@starter/api*',
            '@starter/mobile*',
            'react-native',
            'expo-*',
            'pg',
            'drizzle-orm*',
          ],
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
