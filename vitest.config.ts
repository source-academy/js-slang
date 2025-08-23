import { defineConfig, coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'js-slang',
    include: ['**/__tests__/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        "dist",
        '**/__mocks__/**',
        "node_modules/",
        "src/alt-langs/scheme/scm-slang",
        "src/py-slang/",
        "src/typings",
      ],
      reporter: ['text', 'html', 'lcov']
    },
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true
    },
    reporters: [
      'default',
      ['html', { outputFile: './test-report/index.html '}]
    ],
  }
})