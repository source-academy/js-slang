/**
 * This class represents a literal node in the stepper's AST (Abstract Syntax Tree).
 * It extends both SimpleLiteral and StepperBaseNode to integrate with the stepper system.
 * The class stores value-related properties such as type, value, raw representation,
 * and location metadata.
 *
 * Methods:
 * - isContractible(): Indicates whether this node can be contracted (returns false).
 * - isOneStepPossible(): Indicates whether a single step evaluation is possible (returns false).
 * - contract(): Throws an error as contraction is not implemented.
 * - oneStep(): Throws an error as one-step evaluation is not implemented.
 */
import type { Comment, SimpleLiteral, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import type { StepperBaseNode } from '../../interface'

export class StepperLiteral implements SimpleLiteral, StepperBaseNode {
  type: 'Literal'
  value: string | number | boolean | null
  raw?: string
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    value: string | number | boolean | null,
    raw?: string,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'Literal'
    this.value = value
    this.raw = raw
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(literal: SimpleLiteral) {
    return new StepperLiteral(
      literal.value,
      literal.raw,
      literal.leadingComments,
      literal.trailingComments,
      literal.loc,
      literal.range
    )
  }

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return false
  }

  contract(): StepperLiteral {
    throw new Error('Method not implemented.')
  }

  oneStep(): StepperLiteral {
    throw new Error('Method not implemented.')
  }

  substitute(_id: StepperPattern, _value: StepperExpression): StepperLiteral {
    return this
  }

  freeNames(): string[] {
    return []
  }

  allNames(): string[] {
    return []
  }

  rename(_before: string, _after: string): StepperExpression {
    return new StepperLiteral(
      this.value,
      this.raw,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
