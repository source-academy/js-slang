import type { RequireProvider } from './loader/requireProvider'
import type { ImportAnalysisOptions } from './preprocessor/analyzer'
import type { LinkerOptions } from './preprocessor/linker'

export type ModuleManifest = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = (require: RequireProvider) => ModuleFunctions

export type ModuleFunctions = {
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

export type ImportOptions = {
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions

export type SourceFiles = Partial<Record<string, string>>
export type FileGetter = (p: string) => Promise<string | undefined>
