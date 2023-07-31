import * as es from 'estree'

import { Context } from '..'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Environment, Value } from '../types'
import { BlockExpression, substituterNodes } from '../types'
import * as builtin from './lib'

export function isBuiltinFunction(node: substituterNodes): boolean {
  return (
    node.type === 'Identifier' &&
    // predeclared, except for evaluateMath
    ((typeof builtin[node.name] === 'function' && node.name !== 'evaluateMath') ||
      // one of the math functions
      Object.getOwnPropertyNames(Math)
        .filter(name => typeof Math[name] === 'function')
        .map(name => 'math_' + name)
        .includes(node.name))
  )
}

export function isImportedFunction(node: substituterNodes, context: Context): boolean {
  return (
    node.type === 'Identifier' &&
    Object.keys(context.runtime.environments[0].head).includes(node.name)
  )
}

export function isInfinity(node: substituterNodes): boolean {
  return node.type === 'Identifier' && node.name === 'Infinity'
}

export function isPositiveNumber(node: substituterNodes): boolean {
  return node.type === 'Literal' && typeof node.value === 'number'
}

export function isNegNumber(node: substituterNodes): boolean {
  return (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    (isInfinity(node.argument) || isPositiveNumber(node.argument))
  )
}

export function isNumber(node: substituterNodes): boolean {
  return isPositiveNumber(node) || isNegNumber(node)
}

export function isAllowedLiterals(node: substituterNodes): boolean {
  return node.type === 'Identifier' && ['NaN', 'Infinity', 'undefined'].includes(node.name)
}

export function getDeclaredNames(
  node: es.BlockStatement | BlockExpression | es.Program
): Set<string> {
  const declaredNames = new Set<string>()
  for (const stmt of node.body) {
    // if stmt is assignment or functionDeclaration
    // add stmt into a set of identifiers
    // return that set
    if (stmt.type === 'VariableDeclaration') {
      stmt.declarations
        .map(decn => (decn as es.VariableDeclarator).id as es.Identifier)
        .map(id => id.name)
        .forEach(name => declaredNames.add(name))
    } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      declaredNames.add(stmt.id.name)
    }
  }
  return declaredNames
}

export const handleRuntimeError = (context: Context, error: RuntimeSourceError) => {
  context.errors.push(error)
  throw error
}

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

export function declareIdentifier(
  context: Context,
  name: string,
  node: es.Node,
  environment: Environment
) {
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

export const currentEnvironment = (context: Context) => context.runtime.environments[0]

export function defineVariable(
  context: Context,
  name: string,
  value: Value,
  constant = false,
  node: es.VariableDeclaration | es.ImportDeclaration
) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(context, new errors.VariableRedeclaration(node, name, !constant))
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}
