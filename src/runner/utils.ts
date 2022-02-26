/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  DebuggerStatement,
  Declaration,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  Literal,
  ModuleDeclaration,
  Program,
  Statement
} from 'estree'

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
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') break
    const moduleName = (node.source.value as string).trim()

    // Load the module's tabs
    if (!context.moduleContexts.has(moduleName)) {
      const moduleContext = {
        state: null,
        tabs: loadModuleTabs(moduleName)
      }
      context.moduleContexts.set(moduleName, moduleContext)
    } else {
      context.moduleContexts.get(moduleName)!.tabs = loadModuleTabs(moduleName)
    }
  }
}

/**
 * Hoists import statements in the program to the top
 * Also collates multiple import statements to a module into
 * a single statement
 */
export function hoistImportDeclarations(program: Program) {
  const importNodes = program.body.filter(
    node => node.type === 'ImportDeclaration'
  ) as ImportDeclaration[]
  const specifiers = new Map<
    string,
    (ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier)[]
  >()
  const baseNodes = new Map<string, ImportDeclaration>()

  for (const node of importNodes) {
    const moduleName = node.source.value as string

    if (!specifiers.has(moduleName)) {
      specifiers.set(moduleName, node.specifiers)
      baseNodes.set(moduleName, node)
    } else {
      for (const specifier of node.specifiers) {
        specifiers.get(moduleName)!.push(specifier)
      }
    }
  }

  const newImports = Array.from(baseNodes.entries()).map(([module, node]) => {
    return {
      ...node,
      specifiers: specifiers.get(module)
    }
  }) as (ModuleDeclaration | Statement | Declaration)[]

  program.body = newImports.concat(program.body.filter(node => node.type !== 'ImportDeclaration'))
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
