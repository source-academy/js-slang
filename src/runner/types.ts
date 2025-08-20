import type { Program } from 'estree'
import type { Representation } from '../alt-langs/mapper'
import type { Context, Value } from '../types'

export type Runner = (program: Program, context: Context, options: RunnerOptions) => Promise<Result>

export interface RunnerOptions {
  steps: number
  stepLimit: number
  originalMaxExecTime: number
  isPrelude: boolean
  throwInfiniteLoops: boolean
  envSteps: number
}

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
