import { UNKNOWN_LOCATION } from '../constants'
import { ErrorSeverity, ErrorType, SourceError } from '../types'
import * as tsEs from './tsESTree'

export class TypecheckError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: tsEs.Node | tsEs.TSType, public message: string) {}

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
