import { defineConfig, coverageConfigDefaults } from 'vitest/config';

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
        ...coverageConfigDefaults.exclude,
        "dist",
        'docs',
        '**/__mocks__/**',
        "node_modules/",
        "scripts",
        'sicp_publish',
        "src/alt-langs/scheme/scm-slang",
        "src/py-slang/",
        "src/typings",
        'test-report'
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