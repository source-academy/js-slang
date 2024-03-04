/* eslint-disable @typescript-eslint/no-unused-vars */
import { DebuggerStatement, Literal, Program } from 'estree'

import { IOptions, Result } from '..'
import { parseAt } from '../parser/utils'
import { areBreakpointsSet } from '../stdlib/inspector'
import { Context, RecursivePartial, Variant } from '../types'
import { simple } from '../utils/walkers'

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
  theOptions: IOptions,
  context: Context,
  program: Program,
  verboseErrors: boolean
): void {
  if (theOptions.executionMethod !== 'auto') {
    context.executionMethod = theOptions.executionMethod
    return
  }

  if (context.executionMethod !== 'auto') {
    return
  }

  let isNativeRunnable
  if (verboseErrors) {
    isNativeRunnable = false
  } else if (areBreakpointsSet()) {
    isNativeRunnable = false
  } else if (theOptions.executionMethod === 'auto') {
    if (context.executionMethod === 'auto') {
      if (verboseErrors) {
        isNativeRunnable = false
      } else if (areBreakpointsSet()) {
        isNativeRunnable = false
      } else {
        let hasDebuggerStatement = false
        simple(program, {
          DebuggerStatement(node: DebuggerStatement) {
            hasDebuggerStatement = true
          }
        })
        isNativeRunnable = !hasDebuggerStatement
      }
      context.executionMethod = isNativeRunnable ? 'native' : 'cse-machine'
    } else {
      isNativeRunnable = context.executionMethod === 'native'
    }
  } else {
    let hasDebuggerStatement = false
    simple(program, {
      DebuggerStatement(_node: DebuggerStatement) {
        hasDebuggerStatement = true
      }
    })
    isNativeRunnable = !hasDebuggerStatement
  }

  context.executionMethod = isNativeRunnable ? 'native' : 'cse-machine'
}

// AST Utils

export function hasVerboseErrors(theCode: string): boolean {
  const theProgramFirstExpression = parseAt(theCode, 0)

  if (theProgramFirstExpression && theProgramFirstExpression.type === 'Literal') {
    return (theProgramFirstExpression as unknown as Literal).value === 'enable verbose'
  }

  return false
}

export const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)
