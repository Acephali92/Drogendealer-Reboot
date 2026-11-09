// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    // Domain layer: pure, deterministic, I/O-free (ARCHITECTURE.md §3, ADR-012).
    // It is imported by the balancing simulation (sim/), so it must not depend on
    // the database, the web framework, Node APIs, wall-clock time or Math.random.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@prisma/*', '.prisma/*'], message: 'Domain code must not access the database.' },
            {
              group: ['fastify', '@fastify/*', 'fastify-plugin'],
              message: 'Domain code must not depend on HTTP.',
            },
            { group: ['node:*'], message: 'Domain code must be platform-independent and I/O-free.' },
            {
              group: ['**/modules/**', '**/plugins/**', '**/config/**', '**/lib/**'],
              message: 'Domain code must not import application layers.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use a seeded Rng from domain/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Pass the current time in as a parameter.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pass the current time in as a parameter.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Domain code must not read the environment.' },
        { name: 'fetch', message: 'Domain code must be I/O-free.' },
        { name: 'setTimeout', message: 'Domain code must be I/O-free.' },
        { name: 'setInterval', message: 'Domain code must be I/O-free.' },
      ],
    },
  },
  prettier,
);
