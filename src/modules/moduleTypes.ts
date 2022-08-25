import type { Context } from '../types'

export type Modules = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = (exports: {}, context: { context: Context }) => ModuleFunctions

export type ModuleFunctions = {
  [functionName: string]: Function
}
