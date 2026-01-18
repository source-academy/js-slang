import type { Node } from '../types'
import type { Chapter } from '../langs'
import type { RequireProvider } from './loader/requireProvider'
import type { ImportAnalysisOptions } from './preprocessor/analyzer'
import type { LinkerOptions } from './preprocessor/linker'

/**
 * Represents the meta information for a Source module
 */
export interface ModuleInfo {
  name: string
  tabs: string[]
  version?: string
  requires?: Chapter
  node?: Node
}

/**
 * Represents the main modules manifest that contains a ModuleInfo for each
 * Source module that exists
 */
export interface ModulesManifest {
  [module: string]: Omit<ModuleInfo, 'name'>
}

export type PartialSourceModule = (require: RequireProvider) => LoadedBundle

export type LoadedBundle = {
  [name: string]: any
}

export interface FunctionDocumentation {
  kind: 'function'
  retType: string
  description: string
  params: [name: string, type: string][]
}

export interface VariableDocumentation {
  kind: 'variable'
  type: string
  description: string
}

export interface UnknownDocumentation {
  kind: 'unknown'
}

export const unknownDocs: UnknownDocumentation = { kind: 'unknown' }

export type ModuleDocsEntry = FunctionDocumentation | VariableDocumentation | UnknownDocumentation

export type ModuleDocumentation = {
  [name: string]: ModuleDocsEntry
}

export type Importer<T = object> = (name: string) => Promise<{ default: T }>

export interface ImportLoadingOptions {
  /**
   * Set to `true` to load tabs when loading a module
   */
  loadTabs: boolean

  sourceBundleImporter: Importer<PartialSourceModule>
}

export type ImportOptions = ImportLoadingOptions & ImportAnalysisOptions & LinkerOptions

export type SourceFiles = Partial<Record<string, string>>
export type FileGetter = (p: string) => Promise<string | undefined>
