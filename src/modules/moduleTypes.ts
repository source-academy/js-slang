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
  [functionName: string]: Function
}

interface FunctionDocumentation {
  kind: 'function'
  retType: string
  description: string
  params: [string, string][]
}

interface VariableDocumentation {
  kind: 'variable'
  type: string
  description: string
}

interface UnknownDocumentation {
  kind: 'unknown'
}

export type ModuleDocsEntry = FunctionDocumentation | VariableDocumentation | UnknownDocumentation

export type ModuleDocumentation = Record<string, ModuleDocsEntry>

export type ImportOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions
