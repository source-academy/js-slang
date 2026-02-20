import { generate } from 'astring'
import type { BaseNode, Comment, SourceLocation } from 'estree'
import type { Node } from '../types'
import type { StepperExpression, StepperPattern } from './nodes'

export abstract class StepperBaseNode<TType extends Node = Node> implements BaseNode {
  constructor(
    public readonly type: TType['type'],
    public readonly leadingComments?: Comment[] | undefined,
    public readonly trailingComments?: Comment[] | undefined,
    public readonly loc?: SourceLocation | null | undefined,
    public readonly range?: [number, number] | undefined
  ) {}

  public abstract isContractible(): boolean
  public abstract isOneStepPossible(): boolean
  public abstract contract(): StepperBaseNode<Node>
  public abstract oneStep(): StepperBaseNode<Node>
  public abstract substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode<Node>
  public abstract freeNames(): string[]
  public abstract allNames(): string[]
  public abstract rename(before: string, after: string): StepperBaseNode<Node>

  public toReplString() {
    return generate(this)
  }
}
