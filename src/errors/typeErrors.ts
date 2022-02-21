import { generate } from 'astring'
import * as es from 'estree'

import { ErrorSeverity, ErrorType, SArray, SourceError, Type, TypeAnnotatedNode } from '../types'
import { simplify, stripIndent } from '../utils/formatters'
import { typeToString } from '../utils/stringify'

// tslint:disable:max-classes-per-file

export class InvalidArrayIndexType implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.Node>, public receivedType: Type) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `Expected array index as number, got ${typeToString(this.receivedType)} instead`
  }

  public elaborate() {
    return this.explain()
  }
}

export class ArrayAssignmentError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.Node>,
    public arrayType: SArray,
    public receivedType: SArray
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return stripIndent`Expected array type: ${typeToString(this.arrayType)}
    but got: ${typeToString(this.receivedType)}`
  }

  public elaborate() {
    return this.explain()
  }
}

export class ReassignConstError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.AssignmentExpression>) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const [varName] = formatAssignment(this.node)
    return `Reassignment of constant ${varName}`
  }

  public elaborate() {
    return this.explain()
  }
}

export class DifferentAssignmentError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.AssignmentExpression>,
    public expectedType: Type,
    public receivedType: Type
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const [varName, assignmentStr] = formatAssignment(this.node)
    return stripIndent`
    Expected assignment of ${varName}:
      ${assignmentStr}
    to get a value of type:
      ${typeToString(this.expectedType)}
    but got a value of type:
      ${typeToString(this.receivedType)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

function formatAssignment(node: TypeAnnotatedNode<es.AssignmentExpression>): [string, string] {
  const leftNode = node.left as TypeAnnotatedNode<es.Identifier>
  const assignmentStr = simplify(generate(node.right))
  return [leftNode.name, assignmentStr]
}

export class CyclicReferenceError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.Node>) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `${stringifyNode(this.node)} contains cyclic reference to itself`
  }

  public elaborate() {
    return this.explain()
  }
}

function stringifyNode(node: TypeAnnotatedNode<es.Node>): string {
  return ['VariableDeclaration', 'FunctionDeclaration'].includes(node.type)
    ? node.type === 'VariableDeclaration'
      ? (node.declarations[0].id as es.Identifier).name
      : (node as TypeAnnotatedNode<es.FunctionDeclaration>).id?.name!
    : node.type === 'Identifier'
    ? node.name
    : JSON.stringify(node) // might not be a good idea
}

export class DifferentNumberArgumentsError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.Node>,
    public numExpectedArgs: number,
    public numReceived: number
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `Function expected ${this.numExpectedArgs} args, but got ${this.numReceived}`
  }

  public elaborate() {
    return this.explain()
  }
}
export class InvalidArgumentTypesError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.Node>,
    public args: TypeAnnotatedNode<es.Node>[],
    public expectedTypes: Type[],
    public receivedTypes: Type[]
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const argStrings = this.args.map(arg => simplify(generate(arg)))
    if ('operator' in this.node) {
      const op = this.node.operator
      if (this.expectedTypes.length === 2) {
        // binary operator
        return stripIndent`
        A type mismatch was detected in the binary expression:
          ${argStrings[0]} ${op} ${argStrings[1]}
        The binary operator (${op}) expected two operands with types:
          ${typeToString(this.expectedTypes[0])} ${op} ${typeToString(this.expectedTypes[1])}
        but instead it received two operands of types:
          ${typeToString(this.receivedTypes[0])} ${op} ${typeToString(this.receivedTypes[1])}
        `
      } else {
        // unary operator
        return stripIndent`
        A type mismatch was detected in the unary expression:
          ${op} ${argStrings[0]}
        The unary operator (${op}) expected its operand to be of type:
          ${typeToString(this.expectedTypes[0])}
        but instead it received an operand of type:
          ${typeToString(this.receivedTypes[0])}
        `
      }
    }
    const functionString = simplify(generate(this.node))
    function formatPhrasing(types: Type[]) {
      switch (types.length) {
        // there will at least be one argument
        case 1:
          return `an argument of type:
      ${typeToString(types[0])}`
        default:
          return `${types.length} arguments of types:
      ${types.map(typeToString).join(', ')}`
      }
    }
    return stripIndent`
    A type mismatch was detected in the function call:
      ${functionString}
    The function expected ${formatPhrasing(this.expectedTypes)}
    but instead received ${formatPhrasing(this.receivedTypes)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

function formatNodeWithTest(
  node: TypeAnnotatedNode<
    es.IfStatement | es.ConditionalExpression | es.WhileStatement | es.ForStatement
  >
) {
  let exprString = simplify(generate(node.test))
  let kind: string
  switch (node.type) {
    case 'IfStatement': {
      exprString = `if (${exprString}) { ... } else { ... }`
      kind = 'if statement'
      break
    }
    case 'ConditionalExpression': {
      exprString = `${exprString} ? ... : ...`
      kind = 'conditional expression'
      break
    }
    case 'WhileStatement': {
      exprString = `while (${exprString}) { ... }`
      kind = 'while statement'
      break
    }
    case 'ForStatement': {
      exprString = `for (...; ${exprString}; ...) { ... }`
      kind = 'for statement'
    }
  }
  return { exprString, kind }
}

export class InvalidTestConditionError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<
      es.IfStatement | es.ConditionalExpression | es.WhileStatement | es.ForStatement
    >,
    public receivedType: Type
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const { exprString, kind } = formatNodeWithTest(this.node)
    return stripIndent`
    Expected the test part of the ${kind}:
      ${exprString}
    to have type boolean, but instead it is type:
      ${typeToString(this.receivedType)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

export class UndefinedIdentifierError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.Identifier>, public name: string) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return stripIndent`
    One or more undeclared names detected (e.g. '${this.name}').
    If there aren't actually any undeclared names, then is either a Source or misconfiguration bug.
    Please report this to the administrators!
    `
  }

  public elaborate() {
    return this.explain()
  }
}

export class ConsequentAlternateMismatchError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.IfStatement | es.ConditionalExpression>,
    public consequentType: Type,
    public alternateType: Type
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const { exprString, kind } = formatNodeWithTest(this.node)
    return stripIndent`
    The two branches of the ${kind}:
      ${exprString}
    produce different types!
    The true branch has type:
      ${typeToString(this.consequentType)}
    but the false branch has type:
      ${typeToString(this.alternateType)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

export class CallingNonFunctionType implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.CallExpression>, public callerType: Type) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return stripIndent`
    In
      ${simplify(generate(this.node))}
    expected
      ${simplify(generate(this.node.callee))}
    to be a function type, but instead it is type:
      ${typeToString(this.callerType)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

export class InconsistentPredicateTestError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.CallExpression>,
    public argVarName: string,
    public preUnifyType: Type,
    public predicateType: Type
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    const exprString = generate(this.node)
    return stripIndent`
    Inconsistent type constraints when trying to apply the predicate test
      ${exprString}
    It is inconsistent with the predicate tests applied before it.
    The variable ${this.argVarName} has type
      ${typeToString(this.preUnifyType)}
    but could not unify with type
      ${typeToString(this.predicateType)}
    `
  }

  public elaborate() {
    return this.explain()
  }
}
