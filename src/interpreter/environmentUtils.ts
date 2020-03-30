import * as es from 'estree'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Context, Environment, Frame, Value } from '../types'
import { primitive } from '../utils/astCreator'
import Closure from './closure'

export const createEnvironment = (
  closure: Closure,
  args: Value[],
  callExpression?: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: closure.functionName, // TODO: Change this
    tail: closure.environment,
    head: {}
  }
  if (callExpression) {
    environment.callExpression = {
      ...callExpression,
      arguments: args.map(primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    const ident = param as es.Identifier
    environment.head[ident.name] = args[index]
  })
  return environment
}

export const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment',
  head: Frame = {}
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head,
    thisContext: context
  }
}

export const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const HOISTED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

export function hoistIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = HOISTED_BUT_NOT_YET_ASSIGNED
  return environment
}

export function hoistVariableDeclarations(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    hoistIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

export function hoistFunctionsAndVariableDeclarationsIdentifiers(
  context: Context,
  node: es.BlockStatement
) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        hoistVariableDeclarations(context, statement)
        break
      case 'FunctionDeclaration':
        hoistIdentifier(context, (statement.id as es.Identifier).name, statement)
        break
    }
  }
}

export function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = context.runtime.environments[0]

  if (environment.head[name] !== HOISTED_BUT_NOT_YET_ASSIGNED) {
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

export const currentEnvironment = (context: Context) => context.runtime.environments[0]
export const replaceEnvironment = (context: Context, environment: Environment) =>
  (context.runtime.environments[0] = environment)
export const popEnvironment = (context: Context) => context.runtime.environments.shift()
export const pushEnvironment = (context: Context, environment: Environment) =>
  context.runtime.environments.unshift(environment)

export const getVariable = (context: Context, name: string) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
        return handleRuntimeError(
          context,
          new errors.UnassignedVariable(name, context.runtime.nodes[0])
        )
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

export const setVariable = (context: Context, name: string, value: any) => {
  let environment: Environment | null = context.runtime.environments[0]
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
        break
      }
      const descriptors = Object.getOwnPropertyDescriptors(environment.head)
      if (descriptors[name].writable) {
        environment.head[name] = value
        return undefined
      }
      return handleRuntimeError(
        context,
        new errors.ConstAssignment(context.runtime.nodes[0]!, name)
      )
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}
