import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**', '**/.husky/**'],
  },
  // Only lint TypeScript source files under apps/. Until any app exists, this
  // matches nothing and lint exits cleanly with zero warnings.
  {
    files: ['apps/**/*.ts'],
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['apps/**/*.ts'],
  })),
];
