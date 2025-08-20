import { coverageConfigDefaults, defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'js-slang',
    environment: 'jsdom',
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true
    },
    include: ['src/**/__tests__/**/*.ts'],
    exclude: [
      ...defaultExclude,
      "src/alt-langs/scheme/scm-slang",
      ".*benchmark.*",
      "**/__tests__/**/(.*/)?utils\\.ts"
    ],
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/typings/",
        "src/utils/testing",
        "src/alt-langs/scheme/scm-slang",
        "src/py-slang/"
      ],
      reporter: 'lcov'
    },
    reporters: ['html', 'default'],
    // setupFiles: ['src/utils/testing/setup.ts']
  }
})