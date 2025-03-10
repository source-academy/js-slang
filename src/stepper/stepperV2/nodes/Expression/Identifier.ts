import { Identifier } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'

export class StepperIdentifier implements Identifier, StepperBaseNode {
  type: 'Identifier'
  name: string

  constructor(name: string) {
    this.type = 'Identifier'
    this.name = name
  }

  static create(node: Identifier) {
    return new StepperIdentifier(node.name)
  }

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return false
  }

  contract(): StepperIdentifier {
    throw new Error('Method not implemented.')
  }

  oneStep(): StepperIdentifier {
    throw new Error('Method not implemented.')
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    if (id.name === this.name) {
      redex.postRedex.push(value)
      return value
    } else {
      return this
    }
  }

  freeNames(): string[] {
    return [this.name];
  }

  rename(before: string, after: string) {
    return before === this.name ? new StepperIdentifier(after) : this;
  }
}
