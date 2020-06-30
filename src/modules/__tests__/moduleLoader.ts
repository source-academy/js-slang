/**
 * @jest-environment node
 */

import { loadModuleText, loadIIFEModule } from '../moduleLoader'
import { ModuleNotFound, ModuleInternalError } from '../../errors/errors'
import { stripIndent } from '../../utils/formatters'
import { createEmptyContext } from '../../createContext'

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
  expect(() => loadIIFEModule(path, createEmptyContext(1, 'default', []), wrongModuleText)).toThrow(
    ModuleInternalError
  )
})
