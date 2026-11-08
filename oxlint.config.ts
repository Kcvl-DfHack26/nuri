import { defineConfig } from 'oxlint';
import native from 'oxlint-config-universe/native';
import node from 'oxlint-config-universe/node';
import analysis from 'oxlint-config-universe/typescript-analysis';

export default defineConfig({
  extends: [native, node, analysis],
  plugins: ['typescript', 'import', 'unicorn', 'oxc', 'promise', 'jest', 'react', 'jsx-a11y'],
  jsPlugins: [{ name: 'react-doctor', specifier: 'oxlint-plugin-react-doctor' }],
  ignorePatterns: [
    '.agents/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/.expo/**',
    '**/drizzle/**',
    '.artifacts/**',
  ],
  rules: {
    'no-void': ['error', { allowAsStatement: true }],
    'typescript/no-explicit-any': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'jest/no-focused-tests': 'error',
    'jest/no-disabled-tests': 'error',
  },
  overrides: [
    { files: ['*.config.mjs'], rules: { 'typescript/no-unsafe-assignment': 'off' } },
    {
      files: ['apps/mobile/src/**/*.{ts,tsx}'],
      rules: {
        'react-doctor/effect-listener-cleanup-mismatch': 'error',
        'react-doctor/effect-needs-cleanup': 'error',
        'react-doctor/no-effect-with-fresh-deps': 'error',
        'react-doctor/no-fetch-in-effect': 'error',
        'react-doctor/query-no-rest-destructuring': 'error',
        'react-doctor/query-no-void-query-fn': 'error',
        'react-doctor/query-stable-query-client': 'error',
        'react-doctor/rn-list-data-mapped': 'error',
        'react-doctor/rn-no-falsy-and-render': 'error',
        'react-doctor/rn-no-renderitem-key': 'error',
      },
    },
  ],
});
