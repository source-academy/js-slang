import * as pathlib from 'path'

import { isSourceImport } from '../../utils/ast/typeGuards'
import { memoizedGetModuleManifestAsync } from '../moduleLoaderAsync'
import { ImportResolutionOptions } from '../moduleTypes'

/**
 * Function that returns the full, absolute path to the module being imported
 * @param ourPath Path of the current module
 * @param source Path to the module being imported
 * @param getModuleCode Predicate for checking if the given module exists
 * @param options Import resolution options
 */
export default async function resolveModule(
  ourPath: string,
  source: string,
  getModuleCode: (p: string) => boolean,
  options: Omit<ImportResolutionOptions, 'allowUndefinedImports'>
): Promise<[resolved: boolean, modAbsPath: string]> {
  if (isSourceImport(source)) {
    const moduleManifest = await memoizedGetModuleManifestAsync()
    return [source in moduleManifest, source]
  } else {
    const modAbsPath = pathlib.resolve(ourPath, '..', source)
    if (getModuleCode(modAbsPath)) return [true, modAbsPath]

    if (options.resolveDirectories && getModuleCode(`${modAbsPath}/index`)) {
      return [true, `${modAbsPath}/index`]
    }

    if (options.resolveExtensions) {
      for (const ext of options.resolveExtensions) {
        if (getModuleCode(`${modAbsPath}.${ext}`)) return [true, `${modAbsPath}.${ext}`]

        if (options.resolveDirectories && getModuleCode(`${modAbsPath}/index.${ext}`)) {
          return [true, `${modAbsPath}/index.${ext}`]
        }
      }
    }
    return [false, modAbsPath]
  }
}
