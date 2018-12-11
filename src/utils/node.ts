/**
 * Utility functions to work with the AST (Abstract Syntax Tree)
 */
import * as es from 'estree'
import { Value } from '../types'
const createLiteralNode = (value: {}): es.Node => {
  if (typeof value === 'undefined') {
    return ({
      type: 'Identifier',
      name: 'undefined'
    } as unknown) as es.Node
  } else {
    return ({
      type: 'Literal',
      value,
      raw: value
    } as unknown) as es.SimpleLiteral
  }
}
/**
 * Create an AST node from a Source value.
 *
 * @param value any valid Source value (number/string/boolean/Closure)
 * @returns {Node}
 */
export const createNode = (value: Value): es.Node => {
  return createLiteralNode(value)
}
