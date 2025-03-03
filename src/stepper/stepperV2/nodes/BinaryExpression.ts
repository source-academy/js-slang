import { BinaryExpression, BinaryOperator, Comment, SimpleLiteral, SourceLocation } from 'estree'
import { StepperBaseNode } from '../interface'
import { binaryExpression, literal } from '../../../utils/ast/astCreator'
import { redex } from '..'
import { createStepperExpression, StepperExpression } from './Expression'
import { StepperLiteral } from './Literal'

export class StepperBinaryExpression implements BinaryExpression, StepperBaseNode {
  type: 'BinaryExpression'
  operator: BinaryOperator
  left: StepperExpression
  right: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(expression: BinaryExpression) {
    this.type = 'BinaryExpression'
    this.operator = expression.operator
    this.left = createStepperExpression(expression.left)
    this.right = createStepperExpression(expression.right)
    this.leadingComments = expression.leadingComments
    this.trailingComments = expression.trailingComments
    this.loc = expression.loc
    this.range = expression.range
  }

  isContractible(): boolean {
    if (this.left.type !== 'Literal' || this.right.type !== 'Literal') return false

    const left_type = typeof this.left.value
    const right_type = typeof this.right.value

    if (left_type === 'boolean' && right_type === 'boolean') {
      const ret = (this.operator as string) === '&&' || (this.operator as string) === '||'
      if (ret) {
        redex.preRedex = this
      }
      return ret
    } else if (left_type === 'number' && right_type === 'number') {
      const ret =
        ['*', '+', '/', '-', '===', '<', '>'].includes(this.operator as string) &&
        !(this.operator === '/' && this.right.value === 0)
      if (ret) {
        redex.preRedex = this
      }
      return ret
    } else {
      return false
    }
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }
  contract(): SimpleLiteral & StepperBaseNode {
    redex.preRedex = this
    if (this.left.type !== 'Literal' || this.right.type !== 'Literal') throw new Error()

    const left = this.left.value
    const right = this.right.value

    const op = this.operator as string

    const value =
      (this.operator as string) === '&&'
        ? left && right
        : op === '||'
        ? left || right
        : op === '+' && typeof left === 'number' && typeof right === 'number'
        ? (left as number) + (right as number)
        : op === '+' && typeof left === 'string' && typeof right === 'string'
        ? (left as string) + (right as string)
        : op === '-'
        ? (left as number) - (right as number)
        : op === '*'
        ? (left as number) * (right as number)
        : op === '==='
        ? left === right
        : op === '<'
        ? left! < right!
        : left! > right!

    let ret = createStepperExpression(
      literal(value as string | number | boolean | null)
    ) as StepperLiteral

    redex.postRedex = ret
    return ret
  }

  oneStep(): StepperExpression {
    return this.isContractible()
      ? createStepperExpression(this.contract())
      : this.left.isOneStepPossible()
      ? createStepperExpression(binaryExpression(this.operator, this.left.oneStep(), this.right))
      : createStepperExpression(binaryExpression(this.operator, this.left, this.right.oneStep()))
  }
}
