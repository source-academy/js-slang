import * as es from 'estree'
import { Type, TypeAnnotatedNode, SourceError, ErrorType, ErrorSeverity } from '../types'
import { typeToString } from '../utils/stringify'

// tslint:disable:max-classes-per-file
export class TypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.Node>, public message: string) {
    node.typability = 'Untypable'
  }

  get location() {
    return this.node.loc!
  }
  public explain() {
    return this.message
  }
  public elaborate() {
    return this.message
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
  constructor(public message: string) {
    super()
  }
}

export class UnifyError extends InternalTypeError {
  constructor(public LHS: Type, public RHS: Type) {
    super(`Failed to unify LHS: ${typeToString(LHS)}, RHS: ${typeToString(RHS)}`)
  }
}

export class InternalDifferentNumberArgumentsError extends InternalTypeError {
  constructor(public numExpectedArgs: number, public numReceived: number) {
    super(`Expected ${numExpectedArgs} args, got ${numReceived}`)
  }
}

export class InternalCyclicReferenceError extends InternalTypeError {
  constructor(public name: string) {
    super(`contains a cyclic reference to itself`)
  }
}
