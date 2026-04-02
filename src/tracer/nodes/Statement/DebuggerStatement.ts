import type { Comment, DebuggerStatement, SourceLocation } from 'estree'
import { type StepperExpression, type StepperPattern, undefinedNode } from '..'
import { redex } from '../..'
import { StepperBaseNode } from '../../interface'

export class StepperDebuggerStatement extends StepperBaseNode<DebuggerStatement> implements DebuggerStatement {
  constructor(
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('DebuggerStatement', leadingComments, trailingComments, loc, range)
  }

  static create(node: DebuggerStatement) {
    return new StepperDebuggerStatement(
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

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  contract(): typeof undefinedNode {
    return undefinedNode
  }

  oneStep(): typeof undefinedNode {
    this.contractEmpty()
    return undefinedNode
  }

  substitute(_id: StepperPattern, _value: StepperExpression): StepperBaseNode {
    return this
  }

  freeNames(): string[] {
    return []
  }

  allNames(): string[] {
    return []
  }

  rename(_before: string, _after: string): StepperBaseNode {
    return this
  }
}
