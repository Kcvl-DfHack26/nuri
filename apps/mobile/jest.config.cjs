module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  clearMocks: true,
  passWithNoTests: false,
  // Bun's isolated linker adds .bun before the same packages supported by jest-expo.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.bun|react-native|@react-native|@rn-primitives|expo|@expo|@starter|@testing-library|standard-navigation))',
  ],
};
