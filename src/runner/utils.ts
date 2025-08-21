import type { Program } from 'estree'

import type { Result } from '..'
import { areBreakpointsSet } from '../stdlib/inspector'
import { simple } from '../utils/walkers'
import type { ExecutionMethod, RunnerTypes } from './sourceRunner'

// Context Utils

export function determineExecutionMethod(
  runner: ExecutionMethod,
  program: Program,
  verboseErrors: boolean
): RunnerTypes {
  if (runner !== undefined && runner !== 'auto') {
    // console.log('Runner was specified to be', runner)
    return runner
  }

  if (verboseErrors) {
    // console.log('verbose errors are enabled')
    return 'cse-machine'
  }

  if (areBreakpointsSet()) {
    // console.log('breakpoints are set')
    return 'cse-machine'
  }

  let hasDebuggerStatement = false
  simple(program, {
    DebuggerStatement() {
      hasDebuggerStatement = true
    }
  })

  if (hasDebuggerStatement) {
    // console.log('there are debugger statements')
    return 'cse-machine'
  }

  return 'native'
}

// AST Utils

export const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)
