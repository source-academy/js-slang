import { Identifier, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'

export class StepperIdentifier implements Identifier, StepperBaseNode {
  type: 'Identifier'
  name: string
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    name: string,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'Identifier'
    this.name = name
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: Identifier) {
    return new StepperIdentifier(
      node.name,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return false
  }

  contract(): StepperIdentifier {
    throw new Error('Method not implemented.')
  }

  oneStep(): StepperIdentifier {
    throw new Error('Method not implemented.')
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    if (id.name === this.name) {
      redex.postRedex.push(value)
      return value
    } else {
      return this
    }
  }

  freeNames(): string[] {
    return [this.name];
  }

  allNames(): string[] {
    return [this.name];
  }

  rename(before: string, after: string) {
    return before === this.name ? new StepperIdentifier(
      after,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    ) : this;
  }
}
