// @ts-check

import js from '@eslint/js';
import stylePlugin from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint'
import globals from 'globals'
import * as importPlugin from 'eslint-plugin-import'
import vitestPlugin from '@vitest/eslint-plugin'

export default tseslint.config(
  {
    // global ignores
    ignores: ['dist', 'src/alt-langs', 'src/py-slang', 'src/__tests__/sicp', '**/*.snap']
  },
  {
    extends: [
      ...tseslint.configs.recommended,
      js.configs.recommended
    ],
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
      import: importPlugin,
      '@stylistic': stylePlugin,
    },
    rules: {
      'import/no-duplicates': ['warn', { 'prefer-inline': true }],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          named: {
            import: true,
            types: 'types-last'
          },
          alphabetize: {
            order: 'asc',
            orderImportKind: 'asc'
          },
        }
      ],
      'prefer-const': 'off', // TODO: Remove
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-ex-assign': 'off',
      'no-fallthrough': 'off',
      'no-useless-escape': 'off',
      'no-var': 'off', // TODO: Remove

      'prefer-rest-params': 'off',
      '@stylistic/brace-style': ['warn', '1tbs', { allowSingleLine: true }],
      '@stylistic/semi': ['warn', 'never'],
    }
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-redeclare': 'off',
      'no-unused-vars': 'off',

      '@typescript-eslint/ban-ts-comment': 'off', // TODO: Remove
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-base-to-string': 'off', // TODO: Remove
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'error',
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
    }
  },
  {
    files: [
      '**/__mocks__/**/*.ts', 
      '**/__tests__/**/*.ts', 
      'src/utils/testing/**/*.ts'
    ],
    languageOptions: {
      globals: globals.vitest
    },
    rules: {
      'no-empty-pattern': 'off',
    }
  },
  {
    extends: [vitestPlugin.configs.recommended],
    files: ['**/__tests__/**/*.test.ts'],
    plugins: {
      vitest: vitestPlugin
    },
    rules: {
      'vitest/expect-expect': 'off',
      'vitest/no-alias-methods': 'off',
      'vitest/no-conditional-expect': 'off',
      'vitest/no-export': 'off',
      'vitest/no-focused-tests': ['warn', { fixable: false }],
      'vitest/require-top-level-describe': 'off',
      'vitest/valid-describe-callback': 'off',
      'vitest/valid-expect-in-promise': 'error',
      'vitest/valid-title': ['warn', {
        ignoreTypeOfDescribeName: true
      }]
    }
  },
  {
    files: ['**/*.js', 'src/repl/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
