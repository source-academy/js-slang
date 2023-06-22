import type { RequireProvider } from './requireProvider'

export type ModuleManifest = Record<string, { tabs: string[] }>
export type ModuleBundle = (require: RequireProvider) => ModuleFunctions
export type ModuleFunctions = Record<string, Function>
export type ModuleDocumentation = Record<string, string>

export type ImportTransformOptions = {
  /** Set to true to load module tabs */
  loadTabs: boolean

  /**
   * Wrapping a Source module involves creating nice toString outputs for
   * each of its functions. If this behaviour is desired, set this to true
   */
  wrapModules: boolean
}

export type ImportResolutionOptions = {
  /**
   * Set this to true if directories should be resolved
   * @example
   * ```
   * import { a } from './dir0'; // will resolve to 'dir0/index'
   * ```
   */
  resolveDirectories: boolean

  /**
   * Pass null to enforce strict file names: `'./dir0/file'` will resolve to exactly that path.
   * Otherwise pass an array of file extensions `['js', 'ts']`. For example, if `./dir0/file` is not located,
   * it will then search for that file with the given extension, e.g. `./dir0/file.js`
   */
  resolveExtensions: string[] | null

  /**
   * Set this to true to enforce that imports from modules must be of
   * defined symbols
   */
  allowUndefinedImports: boolean
}

export type ImportOptions = ImportResolutionOptions & ImportTransformOptions