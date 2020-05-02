import * as es from 'estree'
import { Type, SourceError, ErrorType, ErrorSeverity } from '../types'

function printType(type: Type): string {
  // if (type === null) return 'null'
  switch (type.kind) {
    case 'primitive':
      return type.name === 'undefined' ? `undefined` : `a ${type.name}`
    case 'variable':
      return type.isAddable ? `an addable` : `any type`
    case 'function':
      let params = ''
      for (const argument of type.parameterTypes) {
        params += printType(argument) + ', '
      }
      // remove last comma
      params = params.replace(/,\s*$/, '')
      const returnType = printType(type.returnType)
      return `(${params}) => ${returnType}`
    default:
      return 'Not included in Source 1!'
  }
}

/*
When argument type is wrong, eg applying a number to '!'
*/
export class WrongArgumentTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(
    public expectedType: Type,
    receivedType: Type,
    argumentIndex: number,
    public loc: es.SourceLocation
  ) {
    this.message = `The function expects argument #${argumentIndex} to be ${printType(
      expectedType
    )} but got ${printType(receivedType)} instead.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

// When test expression is not a boolean
// tslint:disable-next-line: max-classes-per-file
export class ConditionalTestTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(public nodeType: Type, public loc: es.SourceLocation) {
    this.message = `Test expressions of conditionals should be a boolean, but got ${printType(
      nodeType
    )} instead.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

/*
When consequent != alternate
*/
// tslint:disable-next-line: max-classes-per-file
export class ConditionalTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(
    public consqeuentType: Type,
    public alternateType: Type,
    public loc: es.SourceLocation
  ) {
    this.message = `Expected consequent and alternative to return the same types,
        but the consequent returns ${printType(consqeuentType)}
        and the alternative returns ${printType(alternateType)} instead.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

// /*
// When return statements in a function do not return the same type
// */
// tslint:disable-next-line: max-classes-per-file
export class DifferentReturnTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(public loc: es.SourceLocation) {
    this.message = `All return statements in a function should return the same type.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

// /*
// When number of arguments supplied are different from its type
// */
// tslint:disable-next-line: max-classes-per-file
export class WrongNumberArgumentsError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(
    public declarationArgCount: number,
    public applicationArgCount: number,
    public loc: es.SourceLocation
  ) {
    this.message = `The function expects ${declarationArgCount} argument(s) but ${applicationArgCount} argument(s) are supplied.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

// /*
// When the identifier is not in the type environment
// */
// tslint:disable-next-line: max-classes-per-file
export class IdentifierNotFoundError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(public identifier: string, public loc: es.SourceLocation) {
    this.message = `Identifier with name ${identifier} not found in type environment!`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}

// /*
// For other type errors that occur due to program bugs or user errors that I can't pinpoint a reason about
// */
// tslint:disable-next-line: max-classes-per-file
export class GeneralTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  private message = ''

  constructor(
    public expectedType: Type,
    public actualType: Type,
    public reason: string,
    public loc: es.SourceLocation
  ) {
    this.message = `${reason}: Expected ${printType(expectedType)}, got ${printType(actualType)} instead.`
  }

  get location() {
    return this.loc
  }

  public explain() {
    return this.message
  }

  public elaborate() {
    return this.message
  }
}
