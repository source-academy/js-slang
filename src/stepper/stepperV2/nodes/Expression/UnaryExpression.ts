import {
  Comment,
  SourceLocation,
  UnaryExpression,
  UnaryOperator
} from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperLiteral } from './Literal'
import { convert } from '../../generator'
import { StepperExpression } from '..'
import { StepperIdentifier } from './Identifier'

export class StepperUnaryExpression implements UnaryExpression, StepperBaseNode {
  type: 'UnaryExpression'
  operator: UnaryOperator
  prefix: true
  argument: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    operator: UnaryOperator,
    argument: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'UnaryExpression'
    this.operator = operator
    this.prefix = true
    this.argument = argument
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: UnaryExpression) {
    return new StepperUnaryExpression(
      node.operator,
      convert(node.argument) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    if (this.argument.type !== 'Literal') return false

    switch (typeof this.argument.value) {
      case 'boolean':
        if (this.operator === '!') {
          redex.preRedex = [this]
        }
        return this.operator === '!'
      case 'number':
        if (this.operator === '-') {
          redex.preRedex = [this]
        }
        return this.operator === '-'
      default:
        return false
    }
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.argument.isOneStepPossible()
  }

  contract(): StepperLiteral {
    redex.preRedex = [this]
    if (this.argument.type !== 'Literal') throw new Error()

    const operand = this.argument.value
    if (this.operator === '!') {
      const ret = new StepperLiteral(!operand)
      redex.postRedex = [ret]
      return ret
    } else if (this.operator === '-') {
      const ret = new StepperLiteral(-(operand as number))
      redex.postRedex = [ret]
      return ret
    }

    throw new Error()
  }

  oneStep(): StepperExpression {
    return new StepperUnaryExpression(this.operator, this.argument.oneStep())
  }

  substitute(id: StepperIdentifier, value: StepperExpression): StepperExpression {
      return new StepperUnaryExpression(this.operator, this.argument.substitute(id, value))
  }
}
