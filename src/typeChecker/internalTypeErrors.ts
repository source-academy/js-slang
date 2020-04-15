// TODO delete this
import { Type } from '../types'

// tslint:disable:max-classes-per-file
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
    super('Failed to unify types')
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
