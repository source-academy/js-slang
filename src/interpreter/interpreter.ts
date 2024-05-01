/* tslint:disable:max-classes-per-file */
import type es from 'estree'

import { createBlockEnvironment, pushEnvironment } from '../cse-machine/utils'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import type { Context, Value } from '../types'
import { getModuleDeclarationSource } from '../utils/ast/helpers'

const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement block scope')

function declareIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = DECLARED_BUT_NOT_YET_ASSIGNED
  return environment
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(context.runtime.nodes[0]!, name, !constant)
    )
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

function* visit(context: Context, node: es.Node) {
  checkEditorBreakpoints(context, node)
  context.runtime.nodes.unshift(node)
  yield context
}

function* leave(context: Context) {
  context.runtime.break = false
  context.runtime.nodes.shift()
  yield context
}

const currentEnvironment = (context: Context) => context.runtime.environments[0]

export function* evaluateProgram(
  program: es.Program,
  context: Context,
) {
  yield* visit(context, program)

  context.numberOfOuterEnvironments += 1
  const environment = createBlockEnvironment(context, 'programEnvironment')
  pushEnvironment(context, environment)

  const otherNodes: es.Statement[] = []

  try {
    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration') {
        otherNodes.push(node as es.Statement)
        continue
      }

      yield* visit(context, node)

      const moduleName = getModuleDeclarationSource(node)
      const functions = context.nativeStorage.loadedModules[moduleName]

      for (const spec of node.specifiers) {
        declareIdentifier(context, spec.local.name, node)
        let obj: any

        switch (spec.type) {
          case 'ImportSpecifier': {
            obj = functions[spec.imported.name]
            break
          }
          case 'ImportDefaultSpecifier': {
            obj = functions.default
            break
          }
          case 'ImportNamespaceSpecifier': {
            obj = functions
            break
          }
        }

        defineVariable(context, spec.local.name, obj, true)
      }
      yield* leave(context)
    }
  } catch (error) {
    handleRuntimeError(context, error)
  }
  yield* leave(context) // Done visiting program
}
