import type { Program } from 'estree'

import type { Result } from '..'
import { areBreakpointsSet } from '../stdlib/inspector'
import type {Context, IOptions  } from '../types'
import { simple } from '../utils/walkers'
import type { RunnerTypes } from './sourceRunner'

// Context Utils

export function determineExecutionMethod(
  theOptions: IOptions,
  context: Context,
  program: Program,
  verboseErrors: boolean
): RunnerTypes {
  if (theOptions.executionMethod !== 'auto') {
    return theOptions.executionMethod
  }

  if (context.executionMethod !== 'auto') {
    return context.executionMethod
  }

  let isNativeRunnable
  if (verboseErrors || areBreakpointsSet()) {
    return 'cse-machine'
  } else {
    let hasDebuggerStatement = false
    simple(program, {
      DebuggerStatement() {
        hasDebuggerStatement = true
      }
    })
    isNativeRunnable = !hasDebuggerStatement
  }

  return isNativeRunnable ? 'native' : 'cse-machine'
}

// AST Utils

export const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)
