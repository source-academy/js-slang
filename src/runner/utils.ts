/* eslint-disable @typescript-eslint/no-unused-vars */
import { DebuggerStatement, Literal, Program } from 'estree'

import { IOptions, Result } from '..'
import { loadModuleTabs } from '../modules/moduleLoader'
import { parseAt } from '../parser/parser'
import { areBreakpointsSet } from '../stdlib/inspector'
import { Context, Variant } from '../types'
import { simple } from '../utils/walkers'

// Context Utils

export function isFullJSChapter(chapter: number): boolean {
  return chapter == -1
}

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
export function determineVariant(context: Context, options: Partial<IOptions>): Variant {
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
): boolean {
  let isNativeRunnable
  if (theOptions.executionMethod === 'auto') {
    if (context.executionMethod === 'auto') {
      if (verboseErrors) {
        isNativeRunnable = false
      } else if (areBreakpointsSet()) {
        isNativeRunnable = false
      } else {
        let hasDeuggerStatement = false
        simple(program, {
          DebuggerStatement(node: DebuggerStatement) {
            hasDeuggerStatement = true
          }
        })
        isNativeRunnable = !hasDeuggerStatement
      }
      context.executionMethod = isNativeRunnable ? 'native' : 'interpreter'
    } else {
      isNativeRunnable = context.executionMethod === 'native'
    }
  } else {
    isNativeRunnable = theOptions.executionMethod === 'native'
    context.executionMethod = theOptions.executionMethod
  }
  return isNativeRunnable
}

/**
 * Add UI tabs needed for modules to program context
 *
 * @param program AST of program to be ran
 * @param context The context of the program
 */
export function appendModulesToContext(program: Program, context: Context): void {
  if (context.modules == null) context.modules = []
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') break
    const moduleName = (node.source.value as string).trim()
    Array.prototype.push.apply(context.modules, loadModuleTabs(moduleName))
  }
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
