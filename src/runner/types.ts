import type { Program } from 'estree'
import type { Context, Result } from '..'
import type { Variant } from '../types'

/**
 * Function that takes a user program, context and execution options
 * and returns a `Result`
 */
export type Runner = (
  program: Program,
  context: Context,
  options: ExecutionOptions
) => Promise<Result>

export interface RunnerInfo {
  runner: Runner
  /**
   * Should `validateAndAnnotate` be called on the user
   * program?
   */
  validate: boolean

  /**
   * Should the runner evaluate the prelude?
   */
  prelude: boolean
}

export interface ExecutionOptions {
  steps: number
  stepLimit: number
  variant: Variant
  originalMaxExecTime: number
  isPrelude: boolean
  throwInfiniteLoops: boolean
  envSteps: number
}
