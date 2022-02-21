import * as es from 'estree'

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
