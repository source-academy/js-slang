import { TypeAnnotatedNode, Variable } from '../types'
import * as es from 'estree'
import { ancestor } from 'acorn-walk/dist/walk'

const predefined = new Set([
  '-',
  '*',
  '/',
  '%',
  '&&',
  '||',
  '!',
  '+',
  '===',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  'display',
  'error',
  'Infinity',
  'is_boolean',
  'is_function',
  'is_number',
  'is_string',
  'is_undefined',
  'math_abs',
  'math_acosh',
  'math_acos',
  'math_asin',
  'math_asinh',
  'math_atan',
  'math_atan2',
  'math_atanh',
  'math_cbrt',
  'math_ceil',
  'math_clz32',
  'math_cos',
  'math_cosh',
  'math_exp',
  'math_expml',
  'math_floor',
  'math_fround',
  'math_hypot',
  'math_imul',
  'math_LN2',
  'math_LN10',
  'math_log',
  'math_log1p',
  'math_log2',
  'math_LOG2E',
  'math_log10',
  'math_LOG10E',
  'math_max',
  'math_min',
  'math_PI',
  'math_pow',
  'math_random',
  'math_round',
  'math_sign',
  'math_sin',
  'math_sinh',
  'math_sqrt',
  'math_SQRT1_2',
  'math_SQRT2',
  'math_tan',
  'math_tanh',
  'math_trunc',
  'NaN',
  'parse_int',
  'prompt',
  'runtime',
  'stringify',
  'undefined'
])

export function printTypeConstraints(typeContraints: Map<number, number | string>) {
  console.log('Printing Type Constraints')
  for (const [key, value] of typeContraints) {
    console.log(`T${key} = T${value}`)
  }
  console.log("\n");
}

export function printTypeEnvironment(typeEnvironment: Map<any, any>) {
  console.log('Printing Type Environment')
  for (let [key, value] of typeEnvironment) {
    if (predefined.has(key)) {
      continue
    }
    if (typeof value === 'object') {
      value = JSON.stringify(value)
    }
    console.log(`${key} = T${value}`)
  }
}

export function printTypeAnnotation(program: TypeAnnotatedNode<es.Program>) {
  function getTypeVariableId(node: TypeAnnotatedNode<es.Node>): string {
    return `T${(node.typeVariable as Variable).id}`
  }

  function getExpressionString(node: TypeAnnotatedNode<es.Node>): string {
    switch (node.type) {
      case "Literal": {
        return `${(node as es.Literal).raw}`
      }
      case "Identifier": {
        return (node as es.Identifier).name
      }
      case "BinaryExpression": {
        node = node as es.BinaryExpression
        const left = getExpressionString(node.left)
        const right = getExpressionString(node.right)
        const operator = node.operator
        return `${left} ${operator} ${right}`
      }
      case "UnaryExpression": {
        node = node as es.UnaryExpression
        const operator = node.operator
        const argument = getExpressionString(node.argument)
        return `${operator}${argument}`
      }
      case "ArrowFunctionExpression": {
        // Arrow function expressions may not always have an identifier, so they are represented by a type variable
        return getTypeVariableId(node)
      }
      case "FunctionDeclaration": {
        return getExpressionString(node.id as es.Identifier)
      }
      case "LogicalExpression": {
        node = node as es.LogicalExpression
        const left = getExpressionString(node.left)
        const right = getExpressionString(node.right)
        const operator = node.operator
        return `${left} ${operator} ${right}`
      }
      case "CallExpression": {
        node = node as es.CallExpression
        const callee = getExpressionString(node.callee)
        let params = "("
        for (const argument of node.arguments) {
          params += getExpressionString(argument)
        }
        params += ")"
        return `${callee}${params}`
      }
      default:
        return "This node type is not in Source 1"
    }
  }

  function printLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    console.log(`${getExpressionString(literal)}: ${getTypeVariableId(literal)}`)
  }

  function printConstantDeclaration(declaration: TypeAnnotatedNode<es.VariableDeclarator>) {
    const id: TypeAnnotatedNode<es.Pattern> = declaration.id
    console.log(`${(id as es.Identifier).name}: ${getTypeVariableId(id)}`)
  }

  function printUnaryExpression(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
    console.log(`${getExpressionString(unaryExpression)}: ${getTypeVariableId(unaryExpression)}`)
  }

  function printFunctionDeclaration(functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>) {
    let res = "("
    for (const param of (functionDeclaration as es.FunctionDeclaration).params) {
      res += getTypeVariableId(param)
    }
    res += ") => "
    const result = (functionDeclaration as es.FunctionDeclaration).body
    res += getTypeVariableId(result)
    console.log(`${getExpressionString(functionDeclaration)}: ${res}`)
  }

  function printFunctionDefinition(functionDefinition: TypeAnnotatedNode<es.ArrowFunctionExpression>) {
    let res = "("
    for (const param of (functionDefinition as es.ArrowFunctionExpression).params) {
      res += getTypeVariableId(param)
    }
    res += ") => "
    const result = (functionDefinition as es.ArrowFunctionExpression).body
    res += getTypeVariableId(result)
    console.log(`${getTypeVariableId(functionDefinition)}: ${res}`)
  }

  function printBinaryExpression(binaryExpression: TypeAnnotatedNode<es.BinaryExpression>) {
    console.log(`${getExpressionString(binaryExpression)}: ${getTypeVariableId(binaryExpression)}`)
  }

  function printLogicalExpression(logicalExpression: TypeAnnotatedNode<es.LogicalExpression>) {
    console.log(`${getExpressionString(logicalExpression)}: ${getTypeVariableId(logicalExpression)}`)
  }

  function printFunctionCalls(functionCall: TypeAnnotatedNode<es.CallExpression>) {
    console.log(`${getExpressionString(functionCall)}: ${getTypeVariableId(functionCall)}`)
  }

  console.log("Initial Type Annotations:")
  ancestor(program as es.Node, {
    Literal: printLiteral,
    VariableDeclarator: printConstantDeclaration,
    UnaryExpression: printUnaryExpression,
    BinaryExpression: printBinaryExpression,
    LogicalExpression: printLogicalExpression,
    FunctionDeclaration: printFunctionDeclaration,
    ArrowFunctionExpression: printFunctionDefinition,
    CallExpression: printFunctionCalls,
  })
  console.log("\n");
}
