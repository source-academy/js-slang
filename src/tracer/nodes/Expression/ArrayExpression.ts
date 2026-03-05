import type { ArrayExpression, Comment, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'

export class StepperArrayExpression
  extends StepperBaseNode<ArrayExpression>
  implements ArrayExpression
{
  constructor(
    public readonly elements: (StepperExpression | null)[],
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    super('ArrayExpression', leadingComments, trailingComments, loc, range)
  }

  static create(node: ArrayExpression) {
    return new StepperArrayExpression(
      node.elements.map(element => (element ? (convert(element) as StepperExpression) : null)),
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    return false
  }

  public override isOneStepPossible(): boolean {
    return this.elements.some(element => element && element.isOneStepPossible())
  }

  public override contract(): StepperExpression {
    redex.preRedex = [this]
    throw new Error('Array expressions cannot be contracted')
  }

  public override oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }

    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i]
      if (element && element.isOneStepPossible()) {
        const newElements = [...this.elements]
        newElements[i] = element.oneStep()
        return new StepperArrayExpression(
          newElements,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
    }

    throw new Error('No one step possible')
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.substitute(id, value) : null)),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    const names = this.elements
      .filter(element => element !== null)
      .map(element => element.freeNames())
      .flat()
    return Array.from(new Set(names))
  }

  public override allNames(): string[] {
    const names = this.elements
      .filter(element => element !== null)
      .map(element => element.allNames())
      .flat()
    return Array.from(new Set(names))
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.rename(before, after) : null)),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
