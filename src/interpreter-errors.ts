/* tslint:disable:max-classes-per-file */
import { baseGenerator, generate } from 'astring'
import * as es from 'estree'

import { UNKNOWN_LOCATION } from './constants'
import { stringify } from './interop'
import { ErrorSeverity, ErrorType, SourceError, Value } from './types'

export class RuntimeSourceError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(node?: es.Node) {
    this.location = node ? node.loc! : UNKNOWN_LOCATION
  }

  public explain() {
    return ''
  }

  public elaborate() {
    return this.explain()
  }
}

export class InterruptedError extends RuntimeSourceError {
  constructor(node: es.Node) {
    super(node)
  }

  public explain() {
    return 'Execution aborted by user.'
  }

  public elaborate() {
    return 'TODO'
  }
}

export class ExceptionError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(public error: Error, public location: es.SourceLocation) {}

  public explain() {
    return this.error.toString()
  }

  public elaborate() {
    return 'TODO'
  }
}

export class MaximumStackLimitExceeded extends RuntimeSourceError {
  public static MAX_CALLS_TO_SHOW = 3

  private customGenerator = {
    ...baseGenerator,
    CallExpression(node: any, state: any) {
      state.write(node.callee.name)
      state.write('(')
      const argsRepr = node.arguments.map((arg: any) => stringify(arg.value))
      state.write(argsRepr.join(', '))
      state.write(')')
    }
  }

  constructor(node: es.Node, private calls: es.CallExpression[]) {
    super(node)
  }

  public explain() {
    const repr = (call: es.CallExpression) => generate(call, { generator: this.customGenerator })
    return (
      'Maximum call stack size exceeded\n  ' + this.calls.map(call => repr(call) + '..').join('  ')
    )
  }

  public elaborate() {
    return 'TODO'
  }
}

export class CallingNonFunctionValue extends RuntimeSourceError {
  constructor(private callee: Value, node?: es.Node) {
    super(node)
  }

  public explain() {
    return `Calling non-function value ${stringify(this.callee)}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class UndefinedVariable extends RuntimeSourceError {
  constructor(public name: string, node: es.Node) {
    super(node)
  }

  public explain() {
    return `Name ${this.name} not declared`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class UnassignedVariable extends RuntimeSourceError {
  constructor(public name: string, node: es.Node) {
    super(node)
  }

  public explain() {
    return `Name ${this.name} not yet assigned`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class InvalidNumberOfArguments extends RuntimeSourceError {
  constructor(node: es.Node, private expected: number, private got: number) {
    super(node)
  }

  public explain() {
    return `Expected ${this.expected} arguments, but got ${this.got}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class VariableRedeclaration extends RuntimeSourceError {
  constructor(node: es.Node, private name: string) {
    super(node)
  }

  public explain() {
    return `Redeclaring name ${this.name}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class ConstAssignment extends RuntimeSourceError {
  constructor(node: es.Node, private name: string) {
    super(node)
  }

  public explain() {
    return `Cannot assign new value to constant ${this.name}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class GetPropertyError extends RuntimeSourceError {
  constructor(node: es.Node, private obj: Value, private prop: string) {
    super(node)
  }

  public explain() {
    return `Cannot read property ${this.prop} of ${stringify(this.obj)}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class GetInheritedPropertyError implements RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(node: es.Node, private obj: Value, private prop: string) {
    this.location = node.loc!
  }

  public explain() {
    return `Cannot read inherited property ${this.prop} of ${stringify(this.obj)}`
  }

  public elaborate() {
    return 'TODO'
  }
}

export class SetPropertyError extends RuntimeSourceError {
  constructor(node: es.Node, private obj: Value, private prop: string) {
    super(node)
  }

  public explain() {
    return `Cannot assign property ${this.prop} of ${stringify(this.obj)}`
  }

  public elaborate() {
    return 'TODO'
  }
}
