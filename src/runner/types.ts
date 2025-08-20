import type { Program } from 'estree'
import type { Context, IOptions } from '..'
import type { Representation } from '../alt-langs/mapper'
import type { Value } from '../types'

export type Runner = (program: Program, context: Context, options: IOptions) => Promise<Result>
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
