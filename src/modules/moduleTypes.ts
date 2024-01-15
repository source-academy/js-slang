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

export type ModuleDocumentation = Record<string, string>

export type ImportOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions
