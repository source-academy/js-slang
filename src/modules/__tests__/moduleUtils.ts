import { describe, expect, test } from 'vitest'
import { isSourceModule } from '../utils'

describe('isSourceModule', () => {
  test.each([
    ['Relative paths are not source modules', './module.js', false],
    ['Absolute paths are not source modules', '/module.js', false],
    ['Bare paths are source modules', 'module.js', true]
  ])('%#: %s', (_, moduleName, expected) => expect(isSourceModule(moduleName)).toEqual(expected))
})
