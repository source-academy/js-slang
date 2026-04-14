import { generate } from 'astring';
import type { BaseNode, Comment, SourceLocation } from 'estree';
import type { Node, ReplResult } from '../types';
import type { StepperExpression, StepperPattern } from './nodes';
import type { RedexInfo } from '.';

/**
 * Base type for all Stepper Nodes
 */
export abstract class StepperBaseNode<T extends Node = Node> implements BaseNode, ReplResult {
  constructor(
    public readonly type: T['type'],
    public readonly leadingComments?: Comment[] | undefined,
    public readonly trailingComments?: Comment[] | undefined,
    public readonly loc?: SourceLocation | null | undefined,
    public readonly range?: [number, number] | undefined,
  ) {}

  /**
   * Indicates whether this node can be contracted
   */
  public abstract isContractible(redex: RedexInfo): boolean;

  /**
   * Indicates whether a single step evaluation is possible.
   */
  public abstract isOneStepPossible(redex: RedexInfo): boolean;
  public abstract contract(redex: RedexInfo): StepperBaseNode;
  public abstract oneStep(redex: RedexInfo): StepperBaseNode;
  public abstract substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperBaseNode;
  public abstract freeNames(): string[];
  public abstract allNames(): string[];
  public abstract rename(before: string, after: string): StepperBaseNode;

  public toReplString() {
    // By providing this default toReplString implementation, when the nodes are stringified during
    // error handling, we let astring handle the stringification of the nodes instead of js-slang's
    // default internal implementation
    return generate(this);
  }
}
