import type { Comment, DebuggerStatement, SourceLocation } from 'estree'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { redex } from '../..'
import type { StepperBaseNode } from '../../interface'

export class StepperDebuggerStatement implements DebuggerStatement, StepperBaseNode {
  type: 'DebuggerStatement'
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'DebuggerStatement'
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
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

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return this
  }

  freeNames(): string[] {
    return []
  }

  allNames(): string[] {
    return []
  }

  rename(before: string, after: string): StepperBaseNode {
    return this
  }
}
