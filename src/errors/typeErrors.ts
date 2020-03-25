import * as es from 'estree'
import { ErrorSeverity, ErrorType, SourceError, Type, TypeAnnotatedNode } from '../types'
import { stripIndent } from '../utils/formatters'
import { typeToString } from '../utils/stringify'

// tslint:disable:max-classes-per-file

export class InvalidArgumentTypesError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.Node>,
    public expectedTypes: Type[],
    public receivedTypes: Type[]
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    if (this.expectedTypes.length === 0) {
      return `Expected no arguments to this function, instead received ${this.receivedTypes.length}`
    }
    return stripIndent`The ${
      'operator' in this.node ? `(${this.node.operator}) operator` : 'function'
    } expected arguments to be of the type(s):
      ${this.expectedTypes.map(typeToString).join(', ')}
    but instead received:
      ${this.receivedTypes.map(typeToString).join(', ')}
    `
  }

  public elaborate() {
    return this.explain()
  }
}

export class InvalidTestConditionError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(public node: TypeAnnotatedNode<es.Node>, public receivedType: Type) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `Expected the condition to be a boolean, instead received: ${this.receivedType}`
  }

  public elaborate() {
    return this.explain()
  }
}

export class ConsequentAlternateMismatchError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.WARNING

  constructor(
    public node: TypeAnnotatedNode<es.Node>,
    public consequentType: Type,
    public alternateType: Type
  ) {}

  get location() {
    return this.node.loc!
  }

  public explain() {
    return stripIndent`The if part has type:
      ${this.consequentType}
    but the else part has type:
      ${this.alternateType}`
  }

  public elaborate() {
    return this.explain()
  }
}
