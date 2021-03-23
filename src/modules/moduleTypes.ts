import { Context } from '../index'

export type Modules = {
  [module: string]: {
    tabs: string[]
  }
}

export type ModuleBundle = (context: Context<any>) => ModuleFunctions

export type ModuleFunctions = {
  [functionName: string]: Function
}
