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
      case "Identifier":
        return (node as es.Identifier).name
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
        // TODO: figure out how to print annotation for arrow functions
        // let res = "("
        // for (const param in (node as es.ArrowFunctionExpression).params) {
        //   res += getExpressionString(param)
        // }
          return ''
      }
      case "FunctionDeclaration": {

      }
      case "FunctionExpression": {

      }
      case "Identifier": {

      }
      case "LogicalExpression": {
        
      }
      default:
        return "This node type is not in Source !"
    }
  }

  function printLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    console.log(`${getExpressionString(literal)}: T${getTypeVariableId(literal)}`)
  }

  function printConstantDeclaration(declaration: TypeAnnotatedNode<es.VariableDeclarator>) {
    const id: TypeAnnotatedNode<es.Pattern> = declaration.id
    console.log(`${(id as es.Identifier).name}: T${getTypeVariableId(id)}`)

    if (declaration.init !== null && declaration.init !== undefined) {
      const init: TypeAnnotatedNode<es.Expression> = declaration.init
      console.log(`${(init}: T${getTypeVariableId(id)}`)
    }
  }
  ancestor(program as es.Node, {
    Literal: printLiteral,
    VariableDeclarator: printConstantDeclaration,
  })
}
