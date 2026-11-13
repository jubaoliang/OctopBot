// ESLint flat config on top of eslint-config-expo with strict TypeScript rules.
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'node_modules/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // Strictness gate — keep the codebase honest.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'warn',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    // Route files are entrypoints. Importing them from features/components/
    // (or even from root _layout for a helper) pulls a screen into shared
    // graphs and can split React contexts under Fast Refresh — the
    // "useX must be used inside XProvider" class of bugs. Keep helpers in
    // src/features|core|utils and leave src/app/* as thin wiring.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app', '@/app/*', '@/app/**'],
              message:
                'Do not import expo-router route modules outside src/app/. Put shared helpers in src/features, src/core, or src/utils instead.',
            },
          ],
        },
      ],
    },
  },
]);
