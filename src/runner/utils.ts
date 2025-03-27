import type { Program } from 'estree'

import type { IOptions, Result } from '..'
import { areBreakpointsSet } from '../stdlib/inspector'
import {
  Chapter,
  Variant,
  type Context,
  type ExecutionMethod,
  type RecursivePartial
} from '../types'
import { simple } from '../utils/walkers'
import type { RunnerTypes } from './sourceRunner'

// Context Utils

/**
 * Small function to determine the variant to be used
 * by a program, as both context and options can have
 * a variant. The variant provided in options will
 * have precedence over the variant provided in context.
 *
 * @param context The context of the program.
 * @param options Options to be used when
 *                running the program.
 *
 * @returns The variant that the program is to be run in
 */
export function determineVariant(context: Context, options: RecursivePartial<IOptions>): Variant {
  if (options.variant) {
    return options.variant
  } else {
    return context.variant
  }
}

export function determineExecutionMethod(
  optionMethod: ExecutionMethod,
  context: Context,
  program: Program,
  verboseErrors: boolean
): RunnerTypes {
  if (
    context.chapter === Chapter.FULL_JS ||
    context.chapter === Chapter.FULL_TS ||
    context.chapter === Chapter.PYTHON_1
  )
    return 'fulljs'

  if (context.variant === Variant.EXPLICIT_CONTROL) return 'cse-machine'

  if (optionMethod !== 'auto') return optionMethod

  if (verboseErrors || areBreakpointsSet()) {
    return 'cse-machine'
  } else {
    let hasDebuggerStatement = false
    simple(program, {
      DebuggerStatement() {
        hasDebuggerStatement = true
      }
    })
    if (hasDebuggerStatement) return 'cse-machine'
  }

  return 'native'
}

// AST Utils

export const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)
