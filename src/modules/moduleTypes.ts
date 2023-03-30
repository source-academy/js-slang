import type { RequireProvider } from './requireProvider'

export type Modules = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = (require: RequireProvider) => ModuleFunctions

export type ModuleFunctions = {
  [functionName: string]: Function
}

export type ModuleDocumentation = Record<string, string>
