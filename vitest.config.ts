import { coverageConfigDefaults, defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'js-slang',
    environment: 'jsdom',
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true
    },
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      ...defaultExclude,
      "src/alt-langs/scheme/scm-slang",
      ".*benchmark.*",
    ],
    coverage: {
      include: ['src'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/__mocks__/**',
        "src/typings",
        "src/utils/testing",
        "src/alt-langs/scheme/scm-slang",
        "src/py-slang"
      ],
      reporter: ['text', 'html', 'lcov']
    },
    reporters: [
      ['html', { outputFile: './test-report/index.html' }],
      'default'
    ],
    silent: 'passed-only',
  }
})