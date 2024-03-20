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

export interface FunctionDocumentation {
  kind: 'function'
  name: string
  retType: string
  description: string
  params: Record<string, string>
}

export interface VariableDocumentation {
  kind: 'variable'
  name: string
  type: string
  description: string
}
export type ModuleDocsEntry = FunctionDocumentation | VariableDocumentation

export type ModuleDocumentation = Record<string, ModuleDocsEntry>

export type ImportOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions
