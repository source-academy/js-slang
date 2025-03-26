import { LogicalExpression, LogicalOperator, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperLiteral } from './Literal'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'

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
    range?: [number, number],
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
      return true
    }
    return false
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }

  contract(): StepperExpression {
    redex.preRedex = [this]
    
    if (this.left.type !== 'Literal') throw new Error("Left operand must be a literal to contract")

    const leftValue = this.left.value
    
    if (this.operator === '&&' && !leftValue) {
      let ret = new StepperLiteral(false)
      redex.postRedex = [ret]
      return ret
    } else if (this.operator === '||' && leftValue) {
      let ret = new StepperLiteral(true)
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
      return new StepperLogicalExpression(this.operator, this.left.oneStep(), this.right)
    } else if (this.right.isOneStepPossible()) {
      return new StepperLogicalExpression(this.operator, this.left, this.right.oneStep())
    } else {
      throw new Error("No step possible")
    }
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperLogicalExpression(
      this.operator, 
      this.left.substitute(id, value), 
      this.right.substitute(id, value)
    )
  }

  freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()));
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperLogicalExpression(
      this.operator, 
      this.left.rename(before, after), 
      this.right.rename(before, after)
    );
  }
}
