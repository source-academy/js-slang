import { ConditionalExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'

export class StepperConditionalExpression implements ConditionalExpression, StepperBaseNode {
  type: 'ConditionalExpression'
  test: StepperExpression
  consequent: StepperExpression
  alternate: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    test: StepperExpression,
    consequent: StepperExpression,
    alternate: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    this.type = 'ConditionalExpression'
    this.test = test
    this.consequent = consequent
    this.alternate = alternate
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: ConditionalExpression) {
    return new StepperConditionalExpression(
      convert(node.test) as StepperExpression,
      convert(node.consequent) as StepperExpression,
      convert(node.alternate) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    if (this.test.type !== 'Literal') return false
    const test_value = this.test.value
    if (typeof test_value !== 'boolean') return false
    return true
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || 
           this.test.isOneStepPossible()
  }

  contract(): StepperExpression {
    redex.preRedex = [this]
    if (this.test.type !== 'Literal' || typeof this.test.value !== 'boolean') {
      throw new Error('Cannot contract non-boolean literal test')
    }

    const result = this.test.value ? this.consequent : this.alternate
    redex.postRedex = [result]
    return result
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }

    return new StepperConditionalExpression(
        this.test.oneStep(),
        this.consequent,
        this.alternate
    )
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperConditionalExpression(
      this.test.substitute(id, value),
      this.consequent.substitute(id, value),
      this.alternate.substitute(id, value)
    )
  }

  freeNames(): string[] {
    return Array.from(new Set([
      ...this.test.freeNames(),
      ...this.consequent.freeNames(),
      ...this.alternate.freeNames()
    ]))
  }

  allNames(): string[] {
    return Array.from(new Set([
      ...this.test.allNames(),
      ...this.consequent.allNames(),
      ...this.alternate.allNames()
    ]))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperConditionalExpression(
      this.test.rename(before, after),
      this.consequent.rename(before, after),
      this.alternate.rename(before, after)
    )
  }
}
