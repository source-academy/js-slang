import { generate } from 'astring'
import type { BaseNode, Comment, SourceLocation } from 'estree'
import type { Node } from '../types'
import type { StepperExpression, StepperPattern } from './nodes'

/**
 * Base type for all Stepper Nodes
 */
export abstract class StepperBaseNode<T extends Node = Node> implements BaseNode {
  constructor(
    public readonly type: T['type'],
    public readonly leadingComments?: Comment[] | undefined,
    public readonly trailingComments?: Comment[] | undefined,
    public readonly loc?: SourceLocation | null | undefined,
    public readonly range?: [number, number] | undefined
  ) {}

  public abstract isContractible(): boolean
  public abstract isOneStepPossible(): boolean
  public abstract contract(): StepperBaseNode
  public abstract oneStep(): StepperBaseNode
  public abstract substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode
  public abstract freeNames(): string[]
  public abstract allNames(): string[]
  public abstract rename(before: string, after: string): StepperBaseNode

  public toReplString() {
    // By providing this default toReplString implementation, when the nodes are stringified during
    // error handling, we let astring handle the stringification of the nodes instead of js-slang's
    // default internal implementation
    return generate(this)
  }
}
