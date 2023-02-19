/**
 * Adapted from the legacy interpreter at '../interpreter/interpreter'
 */
/* tslint:disable:max-classes-per-file */
import { generate } from 'astring'
import * as es from 'estree'

import { Context, Environment } from '../types'
import {
  blockArrowFunction,
  identifier,
  returnStatement
} from '../utils/astCreator'
import { dummyLocation } from '../utils/dummyAstCreator'
import { isExpressionBody } from './utils'

/**
 * Models function value in the interpreter environment.
 */
export default class Closure extends Function {
  public static makeFromArrowFunction(
    node: es.ArrowFunctionExpression,
    environment: Environment,
    context: Context,
  ) {
    const functionBody = isExpressionBody(node.body)
      ? [returnStatement(node.body, node.body.loc!)]
      : [node.body, returnStatement(identifier('undefined', dummyLocation()), dummyLocation())]
    const closure = new Closure(
      blockArrowFunction(node.params as es.Identifier[], functionBody, node.loc!),
      environment,
      context
    )

    // Set the closure's node to point back at the original one
    closure.originalNode = node

    return closure
  }

  /** Unique ID defined for anonymous closure */
  public functionName: string

  /** The original node that created this Closure */
  public originalNode: es.Function

  constructor(public node: es.Function, public environment: Environment, context: Context) {
    super()
    this.originalNode = node
    if (this.node.type === 'FunctionDeclaration' && this.node.id !== null) {
      this.functionName = this.node.id.name
    } else {
      this.functionName =
        (this.node.params.length === 1 ? '' : '(') +
        this.node.params.map((o: es.Identifier) => o.name).join(', ') +
        (this.node.params.length === 1 ? '' : ')') +
        ' => ...'
    }
  }

  public toString(): string {
    return generate(this.originalNode)
  }
}
