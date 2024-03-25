import { isSourceModule, removeExportDefault } from '../utils'

describe('removeExportDefault', () => {
  test('Ignores normal strings', () => {
    expect(removeExportDefault('normal string')).toEqual('normal string')
  })

  test('Removes export default keywords and trailing spaces', () => {
    expect(removeExportDefault('export default normal string')).toEqual('normal string')
  })
})

describe('isSourceModule', () => {
  test.each([
    ['Relative paths are not source modules', './module.js', false],
    ['Absolute paths are not source modules', '/module.js', false],
    ['Bare paths are source modules', 'module.js', true]
  ])('%#: %s', (_, moduleName, expected) => expect(isSourceModule(moduleName)).toEqual(expected))
})
