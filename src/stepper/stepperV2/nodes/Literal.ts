import { Comment, SimpleLiteral, SourceLocation } from 'estree'
import { StepperBaseNode } from '../interface'
import { StepperExpression } from './Expression'

export class StepperLiteral implements SimpleLiteral, StepperBaseNode {
  type: 'Literal'
  value: string | number | boolean | null
  raw?: string
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(literal: SimpleLiteral) {
    this.type = 'Literal'
    this.value = literal.value
    this.raw = literal.raw
    this.leadingComments = literal.leadingComments
    this.trailingComments = literal.trailingComments
    this.loc = literal.loc
    this.range = literal.range
  }

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return false
  }

  contract(): SimpleLiteral & StepperBaseNode {
    throw new Error('Method not implemented.')
  }

  oneStep(): StepperExpression {
    throw new Error('Method not implemented.')
  }
}
