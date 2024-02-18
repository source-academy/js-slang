/* tslint:disable:max-classes-per-file */
import * as es from 'estree'

import { createBlockEnvironment, pushEnvironment } from '../ec-evaluator/utils'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { UndefinedImportError } from '../modules/errors'
import { initModuleContext, loadModuleBundle } from '../modules/moduleLoader'
import { ModuleFunctions } from '../modules/moduleTypes'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Value } from '../types'
import assert from '../utils/assert'

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
  checkImports: boolean,
  loadTabs: boolean
) {
  yield* visit(context, program)

  context.numberOfOuterEnvironments += 1
  const environment = createBlockEnvironment(context, 'programEnvironment')
  pushEnvironment(context, environment)

  const otherNodes: es.Statement[] = []
  const moduleFunctions: Record<string, ModuleFunctions> = {}

  try {
    for (const node of program.body) {
      console.log(node)
      if (node.type !== 'ImportDeclaration') {
        otherNodes.push(node as es.Statement)
        continue
      }

      yield* visit(context, node)

      const moduleName = node.source.value
      assert(
        typeof moduleName === 'string',
        `ImportDeclarations should have string sources, got ${moduleName}`
      )

      if (!(moduleName in moduleFunctions)) {
        initModuleContext(moduleName, context, loadTabs)
        moduleFunctions[moduleName] = loadModuleBundle(moduleName, context, node)
      }

      const functions = moduleFunctions[moduleName]
      console.log('tests')

      for (const spec of node.specifiers) {
        assert(
          spec.type === 'ImportSpecifier',
          `Only Import Specifiers are supported, got ${spec.type}`
        )

        if (checkImports && !(spec.imported.name in functions)) {
          throw new UndefinedImportError(spec.imported.name, moduleName, spec)
        }

        declareIdentifier(context, spec.local.name, node)
        const importedObj = functions[spec.imported.name]
        console.log('hi2')
        Object.defineProperty(importedObj, 'name', { value: spec.local.name })
        defineVariable(context, spec.local.name, importedObj, true)
      }
      yield* leave(context)
    }
  } catch (error) {
    handleRuntimeError(context, error)
  }
  yield* leave(context) // Done visiting program
}
