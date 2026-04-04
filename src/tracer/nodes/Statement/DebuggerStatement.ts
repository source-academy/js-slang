import type { Comment, DebuggerStatement, SourceLocation } from 'estree'
import { type StepperExpression, type StepperPattern, undefinedNode } from '..'
import { StepperBaseNode } from '../../interface'
import type { RedexInfo } from '../..'

export class StepperDebuggerStatement
  extends StepperBaseNode<DebuggerStatement>
  implements DebuggerStatement
{
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

  public override isContractible(): boolean {
    return true
  }

  public override isOneStepPossible(): boolean {
    return true
  }

  contractEmpty(redex: RedexInfo) {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override contract(): typeof undefinedNode {
    return undefinedNode
  }

  public override oneStep(redex: RedexInfo): typeof undefinedNode {
    this.contractEmpty(redex)
    return undefinedNode
  }

  public override substitute(_id: StepperPattern, _value: StepperExpression): StepperBaseNode {
    return this
  }

  public override freeNames(): string[] {
    return []
  }

  public override allNames(): string[] {
    return []
  }

  public override rename(_before: string, _after: string): StepperBaseNode {
    return this
  }
}
