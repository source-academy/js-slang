import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: {
      label: 'js-slang',
      color: 'blue'
    },
    include: ['**/__tests__/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      exclude: [
        "dist",
        '**/__mocks__/**',
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