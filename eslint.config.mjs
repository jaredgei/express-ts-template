import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
  { ignores: ['dist', '**/*.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^node:', '^\\u0000?(?:assert|buffer|child_process|cluster|console|crypto|dns|events|fs|http|https|net|os|path|process|querystring|stream|string_decoder|timers|tls|url|util|zlib)(?:/|$)'],
            ['^@?\\w'],
            ['^@/models/'],
            ['^@/routes/'],
            ['^@/handlers/'],
            ['^@/middleware/'],
            ['^@/utils/'],
            ['^@/'],
            ['^\\.'],
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
