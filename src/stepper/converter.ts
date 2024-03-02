import * as es from 'estree'

import { mockContext, mockImportDeclaration } from '../mocks/context'
import { parse } from '../parser/parser'
import { Chapter, Context, substituterNodes } from '../types'
import * as builtin from './lib'
import { javascriptify } from './stepper'
import * as util from './util'

// the value in the parameter is not an ast node, but a underlying javascript value
// return by evaluateBinaryExpression and evaluateUnaryExpression.
export function valueToExpression(value: any, context?: Context): es.Expression {
  if (typeof value === 'object') {
    return {
      type: 'Literal',
      value: value,
      raw: objectToString(value)
    } as es.Literal
  }
  if (typeof value === 'function' && context) {
    let functionName = 'anonymous_' + generateRandomFunctionName()
    while (Object.keys(context.runtime.environments[0]).includes(functionName)) {
      functionName = 'anonymous_' + generateRandomFunctionName()
    }
    util.declareIdentifier(
      context,
      functionName,
      mockImportDeclaration(),
      context.runtime.environments[0]
    )
    util.defineVariable(context, functionName, value, true, mockImportDeclaration())
    return {
      type: 'Identifier',
      name: functionName
    } as es.Identifier
  }
  const programString = (typeof value === 'string' ? `"` + value + `"` : String(value)) + ';'
  const program = parse(programString, context ? context : mockContext(Chapter.SOURCE_2))!
  return (program.body[0] as es.ExpressionStatement).expression
}

function generateRandomFunctionName(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    result += charset[randomIndex]
  }
  return result
}

export function nodeToValue(node: substituterNodes): any {
  return node.type === 'Literal'
    ? node.value
    : util.isBuiltinFunction(node)
    ? builtin[(node as es.Identifier).name]
    : // tslint:disable-next-line
      eval(javascriptify(node))
}

export function nodeToValueWithContext(node: substituterNodes, context: Context): any {
  return node.type === 'Literal'
    ? node.value
    : util.isBuiltinFunction(node)
    ? builtin[(node as es.Identifier).name]
    : node.type === 'Identifier' && util.isImportedFunction(node, context)
    ? context.runtime.environments[0].head[node.name]
    : // tslint:disable-next-line
      evaluateFunctionObject(node, context)
}
function evaluateFunctionObject(node: substituterNodes, context: Context) {
  const builtinFunctions = context.runtime.environments[0].head
  // add identifiers used in the node to the global environment
  function lookUpIdentifiers(node: substituterNodes, visited: Set<substituterNodes>) {
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    if (node.type === 'Identifier' && builtinFunctions[node.name]) {
      global[node.name] = builtinFunctions[node.name]
    }
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        lookUpIdentifiers(node[key], visited)
      }
    }
  }
  lookUpIdentifiers(node, new Set())
  const code = javascriptify(node)
  return eval(code)
}

export function objectToString(value: any): string {
  if (value !== null && 'toReplString' in value) {
    return value.toReplString()
  }
  return '[Object]'
}
