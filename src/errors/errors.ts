import { baseGenerator, generate } from 'astring'
import type es from 'estree'

import { UNKNOWN_LOCATION } from '../constants'
import type { Node, Value } from '../types'
import { stringify } from '../utils/stringify'
import { getSourceVariableDeclaration } from '../utils/ast/helpers'
import { RuntimeSourceError } from './base'

//Wrap build-in function error in SourceError
export class BuiltInFunctionError extends RuntimeSourceError<undefined> {
  constructor(private readonly explanation: string) {
    super(undefined)
    this.explanation = explanation
  }

  public override explain() {
    return `${this.explanation}`
  }

  public override elaborate() {
    return this.explain()
  }
}

export class InterruptedError extends RuntimeSourceError<Node> {
  public override explain() {
    return 'Execution aborted by user.'
  }

  public override elaborate() {
    return 'TODO'
  }
}

/**
 * General Error type to represent RuntimeErrors that aren't thrown by
 * Source
 */
export class ExceptionError extends RuntimeSourceError<undefined> {
  private readonly _location: es.SourceLocation

  constructor(
    public readonly error: Error,
    location?: es.SourceLocation | null
  ) {
    super(undefined)
    this._location = location ?? UNKNOWN_LOCATION
  }

  public override get location() {
    return this._location
  }

  public override explain() {
    return this.error.toString()
  }

  public override elaborate() {
    return 'TODO'
  }
}

export class MaximumStackLimitExceededError extends RuntimeSourceError<Node> {
  public static MAX_CALLS_TO_SHOW = 3

  private customGenerator = {
    ...baseGenerator,
    CallExpression(node: any, state: any) {
      state.write(generate(node.callee))
      state.write('(')
      const argsRepr = node.arguments.map((arg: any) => stringify(arg.value))
      state.write(argsRepr.join(', '))
      state.write(')')
    }
  }

  constructor(
    node: Node,
    private readonly calls: es.CallExpression[]
  ) {
    super(node)
  }

  public override explain() {
    const repr = (call: es.CallExpression) => generate(call, { generator: this.customGenerator })
    return (
      'Maximum call stack size exceeded\n  ' + this.calls.map(call => repr(call) + '..').join('  ')
    )
  }

  public override elaborate() {
    return 'TODO'
  }
}

/**
 * Error thrown when a value that isn't a function is called. Usually thrown by `callIfRightFuncAndArgs`.
 */
export class CallingNonFunctionValueError extends RuntimeSourceError<es.CallExpression> {
  constructor(
    /**
     * Value being called
     */
    private readonly callee: Value,

    /**
     * The {@link es.CallExpression| Call Expression} that is responsible for calling the
     * non-function value
     */
    node: es.CallExpression
  ) {
    super(node)
  }

  public override explain() {
    return `Calling non-function value ${stringify(this.callee)}.`
  }

  public override elaborate() {
    const calleeVal = this.callee
    const calleeStr = stringify(calleeVal)
    const callArgs = this.node.arguments

    const argStr = callArgs.map(generate).join(', ')

    const elabStr = `Because ${calleeStr} is not a function, you cannot run ${calleeStr}(${argStr}).`

    if (Number.isFinite(calleeVal)) {
      const multStr = `If you were planning to perform multiplication by ${calleeStr}, you need to use the * operator.`
      return `${elabStr} ${multStr}`
    } else {
      return elabStr
    }
  }
}

/**
 * Error thrown when an attempt to access an undefined variable is made
 */
export class UndefinedVariableError extends RuntimeSourceError<Node> {
  constructor(
    public readonly varname: string,
    node: Node
  ) {
    super(node)
  }

  public override explain() {
    return `Name ${this.varname} not declared.`
  }

  public override elaborate() {
    return `Before you can read the value of ${this.varname}, you need to declare it as a variable or a constant. You can do this using the let or const keywords.`
  }
}

/**
 * Error thrown when a variable is accessed in the temporal dead zone
 */
export class UnassignedVariableError extends RuntimeSourceError<Node> {
  constructor(
    public readonly varname: string,
    node: Node
  ) {
    super(node)
  }

  public override explain() {
    return `Name ${this.varname} declared later in current scope but not yet assigned`
  }

  public override elaborate() {
    return `If you're trying to access the value of ${this.varname} from an outer scope, please rename the inner ${this.varname}. An easy way to avoid this issue in future would be to avoid declaring any variables or constants with the name ${this.name} in the same scope.`
  }
}

/**
 * Error thrown when a function is called with the incorrect number of arguments. Usually thrown by
 * `callIfRightFuncAndArgs`
 */
export class InvalidNumberOfArgumentsError extends RuntimeSourceError<es.CallExpression> {
  private readonly calleeStr: string

  constructor(
    node: es.CallExpression,
    private readonly expected: number,
    private readonly got: number,
    private readonly hasVarArgs = false
  ) {
    super(node)
    this.calleeStr = generate(node.callee)
  }

  public override explain() {
    return `Expected ${this.expected} ${this.hasVarArgs ? 'or more ' : ''}arguments, but got ${
      this.got
    }.`
  }

  public override elaborate() {
    const calleeStr = this.calleeStr
    const pluralS = this.expected === 1 ? '' : 's'

    return `Try calling function ${calleeStr} again, but with ${this.expected} argument${pluralS} instead. Remember that arguments are separated by a ',' (comma).`
  }
}

export class VariableRedeclarationError extends RuntimeSourceError<
  es.Declaration | es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier
> {
  constructor(
    node:
      | es.Declaration
      | es.ImportSpecifier
      | es.ImportDefaultSpecifier
      | es.ImportNamespaceSpecifier,
    varname: string,
    writable: false
  )
  constructor(node: es.VariableDeclaration, varname: string, writable: boolean)
  constructor(
    node:
      | es.Declaration
      | es.ImportSpecifier
      | es.ImportDefaultSpecifier
      | es.ImportNamespaceSpecifier,
    private readonly varname: string,
    private readonly writable: boolean
  ) {
    super(node)
  }

  public override explain() {
    return `Redeclaring name ${this.varname}.`
  }

  public override elaborate() {
    if (this.writable) {
      const elabStr = `Since ${this.varname} has already been declared, you can assign a value to it without re-declaring.`

      let initStr = ''
      switch (this.node.type) {
        case 'FunctionDeclaration': {
          initStr = '(' + this.node.params.map(generate).join(',') + ') => {...'
          break
        }
        case 'VariableDeclaration': {
          const { init } = getSourceVariableDeclaration(this.node)
          initStr = generate(init)
          break
        }
      }

      return `${elabStr} As such, you can just do\n\n\t${this.varname} = ${initStr};\n`
    } else {
      return `You will need to declare another variable, as ${this.varname} is read-only.`
    }
  }
}

export class ConstAssignmentError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    private readonly varname: string
  ) {
    super(node)
  }

  public override explain() {
    return `Cannot assign new value to constant ${this.varname}.`
  }

  public override elaborate() {
    return `As ${this.varname} was declared as a constant, its value cannot be changed. You will have to declare a new variable.`
  }
}

export class GetPropertyError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    private readonly obj: Value,
    private readonly prop: string
  ) {
    super(node)
  }

  public override explain() {
    return `Cannot read property ${this.prop} of ${stringify(this.obj)}.`
  }

  public override elaborate() {
    return 'TODO'
  }
}

export class GetInheritedPropertyError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    private readonly obj: Value,
    private readonly prop: string
  ) {
    super(node)
  }

  public override explain() {
    return `Cannot read inherited property ${this.prop} of ${stringify(this.obj)}.`
  }

  public override elaborate() {
    return 'TODO'
  }
}

export class SetPropertyError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    private readonly obj: Value,
    private readonly prop: string
  ) {
    super(node)
  }

  public override explain() {
    return `Cannot assign property ${this.prop} of ${stringify(this.obj)}.`
  }

  public override elaborate() {
    return 'TODO'
  }
}
