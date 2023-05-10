import type { RequireProvider } from './requireProvider'

export type ModuleManifest = Record<string, { tabs: string[] }>
export type ModuleBundle = (require: RequireProvider) => ModuleFunctions
export type ModuleFunctions = Record<string, Function>
export type ModuleDocumentation = Record<string, string>

export type ImportTransformOptions = {
  loadTabs: boolean
  wrapModules: boolean
  allowUndefinedImports: boolean
  // useThis: boolean;
}
