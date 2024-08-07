import { generate } from 'astring'

import { UNKNOWN_LOCATION } from '../constants'
import * as tsEs from '../typeChecker/tsESTree'
import { ErrorSeverity, ErrorType, SourceError } from '../types'

// Errors for Source Typed error checker

export class TypeMismatchError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(
    public node: tsEs.Node,
    public actualTypeString: string,
    public expectedTypeString: string
  ) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.actualTypeString}' is not assignable to type '${this.expectedTypeString}'.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeNotFoundError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.Node, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.name}' not declared.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class FunctionShouldHaveReturnValueError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.FunctionDeclaration | tsEs.ArrowFunctionExpression) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return "A function whose declared type is neither 'void' nor 'any' must return a value."
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeNotCallableError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.CallExpression, public typeName: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.typeName}' is not callable.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypecastError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(
    public node: tsEs.TSAsExpression,
    public originalType: string,
    public typeToCastTo: string
  ) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.originalType}' cannot be casted to type '${this.typeToCastTo}' as the two types do not intersect.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeNotAllowedError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.TSType, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.name}' is not allowed.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class UndefinedVariableTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.Node, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Name ${this.name} not declared.`
  }

  public elaborate() {
    return `Before you can read the value of ${this.name}, you need to declare it as a variable or a constant. You can do this using the let or const keywords.`
  }
}

export class InvalidNumberOfArgumentsTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public calleeStr: string

  constructor(
    public node: tsEs.CallExpression,
    public expected: number,
    public got: number,
    public hasVarArgs = false
  ) {
    this.calleeStr = generate(node.callee)
  }

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Expected ${this.expected} ${this.hasVarArgs ? 'or more ' : ''}arguments, but got ${
      this.got
    }.`
  }

  public elaborate() {
    const calleeStr = this.calleeStr
    const pluralS = this.expected === 1 ? '' : 's'

    return `Try calling function ${calleeStr} again, but with ${this.expected} argument${pluralS} instead. Remember that arguments are separated by a ',' (comma).`
  }
}

export class InvalidNumberOfTypeArgumentsForGenericTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.Node, public name: string, public expected: number) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Generic type '${this.name}' requires ${this.expected} type argument(s).`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeNotGenericError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.Node, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.name}' is not generic.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeAliasNameNotAllowedError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.TSTypeAliasDeclaration, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type alias name cannot be '${this.name}'.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class TypeParameterNameNotAllowedError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.TSTypeParameter, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type parameter name cannot be '${this.name}'.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class InvalidIndexTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.MemberExpression, public typeName: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.typeName}' cannot be used as an index type.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class InvalidArrayAccessTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.MemberExpression, public typeName: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type '${this.typeName}' cannot be accessed as it is not an array.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class ConstNotAssignableTypeError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: tsEs.AssignmentExpression, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Cannot assign to '${this.name}' as it is a constant.`
  }

  public elaborate() {
    return this.explain()
  }
}

export class DuplicateTypeAliasError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR

  constructor(public node: tsEs.TSTypeAliasDeclaration, public name: string) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Type alias '${this.name}' has already been declared.`
  }

  public elaborate() {
    return this.explain()
  }
}
