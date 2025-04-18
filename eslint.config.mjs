// @ts-check

import tseslint from 'typescript-eslint'
import globals from 'globals'
import * as importPlugin from 'eslint-plugin-import'

export default tseslint.config(
  {
    // global ignores
    ignores: ['dist', 'src/alt-langs', 'src/py-slang', 'src/__tests__/sicp', '**/*.snap']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts*', 'scripts/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2016,
        ...globals.browser
      },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin
    },
    rules: {
      'import/no-duplicates': ['warn', { 'prefer-inline': true }],
      'import/order': 'warn',
      '@typescript-eslint/no-base-to-string': 'off', // TODO: Remove
      'prefer-const': 'off', // TODO: Remove
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-var': 'off', // TODO: Remove
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'prefer-rest-params': 'off'
    }
  },
  {
    files: ['**/*.js', 'src/repl/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
