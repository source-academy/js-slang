import { loadModulePackageText, loadModulePackage } from '../moduleLoader'
import { ModuleNotFound, ModuleInternalError } from '../../errors/errors'
import { stripIndent } from '../../utils/formatters'
import { createEmptyContext } from '../../createContext'

test('Load a valid module', () => {
  const path = '_mock_dir/_mock_file'
  const moduleText = stripIndent`
    (_params) => {
      return {
        functions: {
          hello: 1
        },
        sideContents: [],
      };
    }
  `
  expect(loadModulePackage(path, createEmptyContext(1, 'default', []), moduleText)).toEqual({
    functions: {
      hello: 1
    },
    sideContents: []
  })
})

test('Try loading a non-existing module', () => {
  const moduleName = '_non_existing_dir/_non_existing_file'
  expect(() => loadModulePackageText(moduleName)).toThrow(ModuleNotFound)
})

test('Try executing a wrongly implemented module', () => {
  // A module in wrong format
  const path = '_mock_dir/_mock_file'
  const wrongModuleText = stripIndent`
    export function es6_function(params) {}
  `
  expect(() =>
    loadModulePackage(path, createEmptyContext(1, 'default', []), wrongModuleText)
  ).toThrow(ModuleInternalError)
})
