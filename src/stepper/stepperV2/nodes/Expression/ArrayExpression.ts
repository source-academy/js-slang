import { ArrayExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'

export class StepperArrayExpression implements ArrayExpression, StepperBaseNode {
  type: 'ArrayExpression'
  elements: (StepperExpression | null)[]
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    elements: (StepperExpression | null)[],
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'ArrayExpression'
    this.elements = elements
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
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

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return this.elements.some(element => element && element.isOneStepPossible())
  }

  contract(): StepperExpression {
    redex.preRedex = [this]
    throw new Error('Array expressions cannot be contracted')
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }

    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i]
      if (element && element.isOneStepPossible()) {
        const newElements = [...this.elements]
        newElements[i] = element.oneStep()
        return new StepperArrayExpression(newElements)
      }
    }

    throw new Error('No one step possible')
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.substitute(id, value) : null))
    )
  }

  freeNames(): string[] {
    const names = this.elements
      .filter(element => element !== null)
      .map(element => element!.freeNames())
      .flat()
    return Array.from(new Set(names))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperArrayExpression(
      this.elements.map(element => (element ? element.rename(before, after) : null))
    )
  }
}
