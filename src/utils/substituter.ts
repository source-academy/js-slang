import * as es from 'estree'
import * as misc from '../stdlib/misc'
import { codify } from '../substituter'
import { substituterNodes } from '../types'
import * as ast from './astCreator'

// define builtins that takes in AST, and return AST
//
// if (context.chapter >= 1) {
//   defineBuiltin(context, 'runtime()', misc.runtime)
export function runtime(): es.Literal {
  return ast.literal(misc.runtime())
}

//   defineBuiltin(context, 'display(val)', display)
//   ignore the "display" capability
export function display(val: substituterNodes): substituterNodes {
  return val
}

//   defineBuiltin(context, 'raw_display(str)', rawDisplay)
//   defineBuiltin(context, 'stringify(val)', stringify)
export const stringify = codify

//   defineBuiltin(context, 'error(str)', misc.error_message)
export function error(val: substituterNodes, str?: substituterNodes) {
  const output = (str === undefined ? '' : str + ' ') + stringify(val)
  throw new Error(output)
}

//   defineBuiltin(context, 'prompt(str)', prompt)
export function prompt(str: substituterNodes): substituterNodes {
  if (str.type !== 'Literal' || typeof str.value !== 'string') {
    throw new Error('Argument to error must be a string.')
  }
  const result = window.prompt(str.value as string)
  return result ? ast.literal(result) : ast.identifier('null')
}

const astTrue = ast.literal(true)
const astFalse = ast.literal(true)

//   defineBuiltin(context, 'is_number(val)', misc.is_number)
export function is_number(val: substituterNodes): es.Literal {
  return val.type === 'Literal' && typeof val.value === 'number' ? astTrue : astFalse
}

//   defineBuiltin(context, 'is_string(val)', misc.is_string)
export function is_string(val: substituterNodes): es.Literal {
  return val.type === 'Literal' && typeof val.value === 'string' ? astTrue : astFalse
}

//   defineBuiltin(context, 'is_function(val)', misc.is_function)
export function is_function(val: substituterNodes): es.Literal {
  return val.type.includes('Function') ? astTrue : astFalse
}

//   defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
export function is_boolean(val: substituterNodes): es.Literal {
  return val.type === 'Literal' && typeof val.value === 'boolean' ? astTrue : astFalse
}

//   defineBuiltin(context, 'is_undefined(val)', misc.is_undefined)
export function is_undefined(val: substituterNodes): es.Literal {
  return val.type === 'Identifier' && val.name === 'undefined' ? astTrue : astFalse
}

//   defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
export function parse_int(str: substituterNodes, radix: substituterNodes): es.Literal {
  if (
    str.type === 'Literal' &&
    typeof str.value === 'string' &&
    (radix.type === 'Literal' && typeof radix.value === 'number') &&
    Number.isInteger(radix.value) &&
    2 <= radix.value &&
    radix.value <= 36
  ) {
    return ast.literal(parseInt(str.value, radix.value))
  } else {
    throw new Error(
      'parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive.'
    )
  }
}

//   defineBuiltin(context, 'undefined', undefined)
//   defineBuiltin(context, 'NaN', NaN)
//   defineBuiltin(context, 'Infinity', Infinity)
//   // Define all Math libraries
//   const props = Object.getOwnPropertyNames(Math)
//   for (const prop of props) {
//     defineBuiltin(context, 'math_' + prop, Math[prop])
//   }
// }
// evaluateMath(mathFn: string, ...args: substituterNodes): substituterNodes
export function evaluateMath(mathFn: string, ...args: substituterNodes[]): es.Literal {
  const fn = Math[mathFn.split('_')[1]]
  if (!fn) {
    throw new Error(`Math function ${mathFn} not found.`)
  } else if (args.some(arg => arg.type !== 'Literal')) {
    throw new Error(`Math functions must be called with number arguments`)
  }
  const jsArgs = args.map(arg => (arg as es.Literal).value!)
  return ast.literal(fn(...jsArgs))
}

// if (context.chapter >= 2) {
//   // List library
//   defineBuiltin(context, 'pair(left, right)', list.pair)
export function pair(left: substituterNodes, right: substituterNodes): es.ArrayExpression {
  return ast.arrayExpression([left as es.Expression, right as es.Expression])
}

//   defineBuiltin(context, 'is_pair(val)', list.is_pair)
export function is_pair(val: substituterNodes): es.Literal {
  return ast.literal(val.type === 'ArrayExpression' && val.elements.length === 2)
}

//   defineBuiltin(context, 'head(xs)', list.head)
export function head(xs: substituterNodes): es.Expression {
  if (is_pair(xs).value === false) {
    throw new Error(`${codify(xs)} is not a pair`)
  }
  return (xs as es.ArrayExpression).elements[0] as es.Expression
}

//   defineBuiltin(context, 'tail(xs)', list.tail)
export function tail(xs: substituterNodes): es.Expression {
  if (is_pair(xs).value === false) {
    throw new Error(`${codify(xs)} is not a pair`)
  }
  return (xs as es.ArrayExpression).elements[1] as es.Expression
}

//   defineBuiltin(context, 'is_null(val)', list.is_null)
export function is_null(val: substituterNodes): es.Literal {
  return ast.literal(val.type === 'Literal' && val.value === null)
}

//   defineBuiltin(context, 'list(...values)', list.list)
export function list(...values: substituterNodes[]): es.ArrayExpression {
  let ret: es.Expression = ast.primitive(null)
  for (const v of values.reverse()) {
    ret = pair(v, ret)
  }
  return ret as es.ArrayExpression
}
//   defineBuiltin(context, 'draw_data(xs)', visualiseList)
export function draw_data(xs: substituterNodes): es.Identifier {
  return ast.primitive(undefined) as es.Identifier
}
