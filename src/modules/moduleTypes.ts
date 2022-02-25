import { ModuleContext } from '../types'

export type Modules = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = (params: any, context: Map<string, ModuleContext>) => ModuleFunctions

export type ModuleFunctions = {
  [functionName: string]: Function
}
