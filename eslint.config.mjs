// @ts-check

import vitestPlugin from '@vitest/eslint-plugin'
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
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2016,
        ...globals.browser
      },
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      'import/first': 'warn',
      'import/no-duplicates': ['warn', { 'prefer-inline': true }],
      'import/order': 'warn',

      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-restricted-imports': [
        'error',
        {
          paths: [{
            name: 'commander',
            message: 'Import from @commander-js/extra-typings instead'
          }]
        }
      ],
      'no-var': 'off', // TODO: Remove
      'object-shorthand': ['warn', 'properties'],
      'prefer-const': 'off', // TODO: Remove
      'prefer-rest-params': 'off',
    }
  },
  {
    files: ['**/*.ts*'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
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
    extends: [vitestPlugin.configs.recommended],
    files: ['**/__tests__/**/*.test.ts'],
    plugins: {
      vitest: vitestPlugin
    },
    rules: {
      'no-empty-pattern': 'off',
      'vitest/expect-expect': 'off', // TODO turn this back on
      'vitest/prefer-describe-function-title': 'warn',
      'vitest/valid-describe-callback': 'off',
      'vitest/valid-title': 'off',
    }
  },
  {
    files: ['**/*.js', 'src/repl/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
