import { UNKNOWN_LOCATION } from '../constants'
import { ErrorSeverity, ErrorType, SourceErrorWithNode, type SourceError } from '../errors/base'
import type { Node, NodeWithInferredType, Type } from '../types'
import { typeToString } from '../utils/stringify'
import type * as tsEs from './tsESTree'

export class SourceTypeError<T extends Node> extends SourceErrorWithNode<NodeWithInferredType<T>> {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    node: NodeWithInferredType<Node>,
    public readonly errMsg: string
  ) {
    super(node)
    node.typability = 'Untypable'
  }

  public override explain() {
    return this.errMsg
  }
  public override elaborate() {
    return this.errMsg
  }
}

/**
 * Temporary error that will eventually be converted to TypeError as some errors are only thrown
 * where there is no handle to the node
 */
export class InternalTypeError extends Error {
  // constructor(public message: string, ...params: any[]) {
  //   super(...params)
  // }
  constructor(public readonly errMsg: string) {
    super()
  }
}

export class UnifyError extends InternalTypeError {
  constructor(
    public readonly LHS: Type,
    public readonly RHS: Type
  ) {
    super(`Failed to unify LHS: ${typeToString(LHS)}, RHS: ${typeToString(RHS)}`)
  }
}

export class InternalDifferentNumberArgumentsError extends InternalTypeError {
  constructor(
    public readonly numExpectedArgs: number,
    public readonly numReceived: number
  ) {
    super(`Expected ${numExpectedArgs} args, got ${numReceived}`)
  }
}

export class InternalCyclicReferenceError extends InternalTypeError {
  constructor(public readonly symbol: string) {
    super(`contains a cyclic reference to itself`)
  }
}

export class TypecheckError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: tsEs.Node | tsEs.TSType,
    public message: string
  ) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }
  public explain() {
    return this.message
  }
  public elaborate() {
    return this.message
  }
}
