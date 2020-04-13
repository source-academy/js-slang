/**
 * @jest-environment node
 */

import { loadIIFEModuleText } from '../moduleLoader'
import { ModuleNotFound } from '../../errors/errors'

test('Try loading a non-existing module', () => {
  const moduleName = '_non_existing_dir/_non_existing_file'
  expect(() => loadIIFEModuleText(moduleName)).toThrow(ModuleNotFound)
})
