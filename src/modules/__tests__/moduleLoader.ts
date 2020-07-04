/**
 * @jest-environment node
 */

import { loadModuleText, loadModule } from '../moduleLoader'
import { ModuleNotFound, ModuleInternalError } from '../../errors/errors'
import { stripIndent } from '../../utils/formatters'
import { createEmptyContext } from '../../createContext'

test('Load a valid module', () => {
  const path = '_mock_dir/_mock_file'
  const moduleText = stripIndent`
    (_params) => {
      return {
        hello: 1
      };
    }
  `
  expect(loadModule(path, createEmptyContext(1, 'default', []), moduleText)).toEqual({
    hello: 1
  })
})

test('Try loading a non-existing module', () => {
  const moduleName = '_non_existing_dir/_non_existing_file'
  expect(() => loadModuleText(moduleName)).toThrow(ModuleNotFound)
})

test('Try executing a wrongly implemented module', () => {
  // A module in wrong format
  const path = '_mock_dir/_mock_file'
  const wrongModuleText = stripIndent`
    export function es6_function(params) {}
  `
  expect(() => loadModule(path, createEmptyContext(1, 'default', []), wrongModuleText)).toThrow(
    ModuleInternalError
  )
})
