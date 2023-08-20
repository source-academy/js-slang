import type { RequireProvider } from './requireProvider'

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

export type ImportTransformOptions = {
  wrapSourceModules: boolean
  loadTabs: boolean
  checkImports: boolean
}
