import { Comment, SimpleLiteral, SourceLocation, UnaryExpression, UnaryOperator } from 'estree'
import { StepperBaseNode } from '../interface'
import { literal, unaryExpression } from '../../../utils/ast/astCreator'
import { redex } from '..'
import { createStepperExpression, StepperExpression } from './Expression'
import { StepperLiteral } from './Literal'

export class StepperUnaryExpression implements UnaryExpression, StepperBaseNode {
  type: 'UnaryExpression'
  operator: UnaryOperator
  prefix: true
  argument: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(node: UnaryExpression) {
    this.type = 'UnaryExpression'
    this.operator = node.operator
    this.prefix = node.prefix
    this.argument = createStepperExpression(node.argument)
    this.leadingComments = node.leadingComments
    this.trailingComments = node.trailingComments
    this.loc = node.loc
    this.range = node.range
  }

  isContractible(): boolean {
    if (this.argument.type !== 'Literal') return false

    switch (typeof this.argument.value) {
      case 'boolean':
        if (this.operator === '!') {
          redex.preRedex = this
        }
        return this.operator === '!'
      case 'number':
        if (this.operator === '-') {
          redex.preRedex = this
        }
        return this.operator === '-'
      default:
        return false
    }
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.argument.isOneStepPossible()
  }

  contract(): SimpleLiteral & StepperBaseNode {
    redex.preRedex = this
    if (this.argument.type !== 'Literal') throw new Error()

    const operand = this.argument.value
    if (this.operator === '!') {
      const ret = createStepperExpression(literal(!operand)) as StepperLiteral
      redex.postRedex = ret
      return ret
    } else if (this.operator === '-') {
      const ret = createStepperExpression(literal(-(operand as number))) as StepperLiteral
      redex.postRedex = ret
      return ret
    }

    throw new Error()
  }

  oneStep(): StepperExpression & StepperBaseNode {
    return createStepperExpression(unaryExpression(this.operator, this.argument.oneStep()))
  }
}
