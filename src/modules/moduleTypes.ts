import type { ImportAnalysisOptions } from './preprocessor/analyzer'
import type { LinkerOptions } from './preprocessor/linker'

export type ModuleManifest = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = Record<string, any>

export type ModuleDocumentation = Record<string, string>

export type ImportOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions
