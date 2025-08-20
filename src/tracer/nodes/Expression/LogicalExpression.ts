import { Comment, LogicalExpression, LogicalOperator, SourceLocation } from 'estree'
import { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { StepperLiteral } from './Literal'

export class StepperLogicalExpression implements LogicalExpression, StepperBaseNode {
  type: 'LogicalExpression'
  operator: LogicalOperator
  left: StepperExpression
  right: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    operator: LogicalOperator,
    left: StepperExpression,
    right: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'LogicalExpression'
    this.operator = operator
    this.left = left
    this.right = right
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: LogicalExpression) {
    return new StepperLogicalExpression(
      node.operator,
      convert(node.left) as StepperExpression,
      convert(node.right) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    if (this.left.type === 'Literal') {
      const leftType = typeof this.left.value

      if (leftType !== 'boolean') {
        throw new Error(
          `Line ${
            this.loc?.start.line || 0
          }: Expected boolean on left hand side of operation, got ${leftType}.`
        )
      }

      redex.preRedex = [this]
      return true
    }

    return false
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }

  contract(): StepperExpression {
    redex.preRedex = [this]

    if (this.left.type !== 'Literal') throw new Error('Left operand must be a literal to contract')

    const leftValue = this.left.value

    if (this.operator === '&&' && !leftValue) {
      let ret = new StepperLiteral(
        false,
        undefined,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    } else if (this.operator === '||' && leftValue) {
      let ret = new StepperLiteral(
        true,
        undefined,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    } else {
      return this.right
    }
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    } else if (this.left.isOneStepPossible()) {
      return new StepperLogicalExpression(
        this.operator,
        this.left.oneStep(),
        this.right,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else if (this.right.isOneStepPossible()) {
      return new StepperLogicalExpression(
        this.operator,
        this.left,
        this.right.oneStep(),
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else {
      throw new Error('No step possible')
    }
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperLogicalExpression(
      this.operator,
      this.left.substitute(id, value),
      this.right.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()))
  }

  allNames(): string[] {
    return Array.from(new Set([this.left.allNames(), this.right.allNames()].flat()))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperLogicalExpression(
      this.operator,
      this.left.rename(before, after),
      this.right.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
