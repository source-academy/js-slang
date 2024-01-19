import type { ImportDeclaration } from 'estree'

import type { ImportAnalysisOptions } from './preprocessor/analyzer'
import type { LinkerOptions } from './preprocessor/linker'

export type ModuleManifest = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle<T extends Record<string, any> = Record<string, any>> = {
  rawBundle: T
  symbols: Set<keyof T>
  get: (spec: ImportDeclaration['specifiers'][number]) => T[keyof T]
  getWithName: (importedName: keyof T, localName: string) => T[keyof T]
}

export type ModuleFunctions = {
  [functionName: string]: Function
}

export type ModuleDocumentation = Record<string, string>

export type ImportOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
} & ImportAnalysisOptions &
  LinkerOptions
