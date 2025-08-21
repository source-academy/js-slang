import type { Program } from 'estree'
import type { Representation } from '../alt-langs/mapper'
import type { Context, Value } from '../types'

export interface BaseRunnerOptions {
  isPrelude?: boolean | undefined
}

export interface UnknownRunner extends BaseRunnerOptions {
  executionMethod?: 'auto'
}

export type Runner<T extends BaseRunnerOptions> = (
  program: Program,
  context: Context,
  options: Partial<T>
) => Promise<Result>

export interface Error {
  status: 'error'
}

export interface Finished {
  status: 'finished'
  context: Context
  value: Value
  representation?: Representation // if the returned value needs a unique representation,
}

export interface SuspendedCseEval {
  status: 'suspended-cse-eval'
  context: Context
}

export type Result = Finished | Error | SuspendedCseEval
