import type { Comment, SourceLocation, ReturnStatement } from 'estree'
import type { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'

export class StepperReturnStatement implements ReturnStatement, StepperBaseNode {
  type: 'ReturnStatement'
  argument: StepperExpression | null
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    argument: StepperExpression | null,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'ReturnStatement'
    this.argument = argument
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: ReturnStatement) {
    return new StepperReturnStatement(
      node.argument ? (convert(node.argument) as StepperExpression) : null,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return true
  }

  isOneStepPossible(): boolean {
    return true
  }

  contract(): StepperExpression {
    if (!this.argument) {
      throw new Error('Cannot contract return statement without argument')
    }
    redex.preRedex = [this]
    redex.postRedex = [this.argument]
    return this.argument
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  oneStep(): StepperExpression {
    if (!this.argument) {
      throw new Error('Cannot step return statement without argument')
    }
    return this.contract()
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperReturnStatement(
      this.argument ? this.argument.substitute(id, value) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    return this.argument ? this.argument.freeNames() : []
  }

  allNames(): string[] {
    return this.argument ? this.argument.allNames() : []
  }

  rename(before: string, after: string): StepperReturnStatement {
    return new StepperReturnStatement(
      this.argument ? this.argument.rename(before, after) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
