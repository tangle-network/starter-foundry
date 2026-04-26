// Flat-config ESLint for starter-foundry. Strict TypeScript discipline:
// no `any`, no implicit `any`, exhaustive switches, consistent imports,
// no floating promises, no unused locals. Prettier handles formatting;
// eslint-config-prettier disables rules that conflict.

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-tests/**',
      'node_modules/**',
      'coverage/**',
      '.evolve/**',
      'registry/**',
      'corpus/**',
      'specs/**',
      'src/types/registry-schemas.generated.ts',
      // Tests are excluded from type-aware lint — they have their own
      // tsconfig.test.json, are validated by the test suite, and use
      // dynamic shapes that lint false-flags. Tests still run through
      // the typechecker via `pnpm test`.
      'tests/**',
      // Scripts live outside src/ rootDir and aren't part of the main
      // tsconfig project; they're invoked via `pnpm exec tsx`. The
      // typescript-eslint projectService cannot parse them without a
      // dedicated tsconfig, and they have their own runtime contract.
      'scripts/**',
      'vscode-extension/**',
      'eslint.config.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX },
    rules: {
      // ─── BUG-CATCHING — strict (these catch real defects, never just style) ───
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-useless-assignment': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',

      // ─── STYLISTIC-STRICT — warn (clean up incrementally, don't block commits) ───
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/no-unnecessary-type-conversion': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/return-await': 'warn',

      // Import order is style — warn, autofixable
      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // No console in src — warn level (scripts override below)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts can console.log freely (operational output)
    files: ['scripts/**/*.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
  prettier,
)
