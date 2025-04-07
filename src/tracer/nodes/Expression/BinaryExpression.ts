import { BinaryExpression, BinaryOperator, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperLiteral } from './Literal'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
export class StepperBinaryExpression implements BinaryExpression, StepperBaseNode {
  type: 'BinaryExpression'
  operator: BinaryOperator
  left: StepperExpression
  right: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    operator: BinaryOperator,
    left: StepperExpression,
    right: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    this.type = 'BinaryExpression'
    this.operator = operator
    this.left = left
    this.right = right
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: BinaryExpression) {
    return new StepperBinaryExpression(
      node.operator,
      convert(node.left) as StepperExpression,
      convert(node.right) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    if (this.left.type !== 'Literal' || this.right.type !== 'Literal') {
      return false;
    }
    const left_type = typeof this.left.value
    const right_type = typeof this.right.value

    if (left_type === 'boolean' && right_type === 'boolean') {
      const ret = (this.operator as string) === '&&' || (this.operator as string) === '||'
      if (ret) {
        redex.preRedex = [this]
      }
      return ret
    } else if (left_type === 'number' && right_type === 'number') {
      const ret =
        ['*', '+', '/', '-', '===', '!==', '<', '>', '<=', '>=', '%'].includes(this.operator as string)
      if (ret) {
        redex.preRedex = [this]
      }
      return ret
    } else {
      return false
    }
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.left.isOneStepPossible() || this.right.isOneStepPossible()
  }

  contract(): StepperExpression {
    redex.preRedex = [this]
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
        : op === '%'
        ? (left as number) % (right as number)
        : op === '/'
        ? (left as number) / (right as number)
        : op === '==='
        ? left === right
        : op === '!=='
        ? left !== right
        : op === '<'
        ? left! < right!
        : op === '<='
        ? left! <= right!
        : op === '>='
        ? left! >= right!
        : left! > right!

    let ret = new StepperLiteral(value, value !== null ? value.toString() : "null")
    redex.postRedex = [ret]
    return ret
  }

  oneStep(): StepperExpression {
    return this.isContractible()
      ? this.contract()
      : this.left.isOneStepPossible()
      ? new StepperBinaryExpression(this.operator, this.left.oneStep(), this.right)
      : new StepperBinaryExpression(this.operator, this.left, this.right.oneStep())
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
      return new StepperBinaryExpression(this.operator, this.left.substitute(id, value), this.right.substitute(id, value)) 
  }

  freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()));
  }

  allNames(): string[] {
    return Array.from(new Set([this.left.allNames(), this.right.allNames()].flat()));
  }

  rename(before: string, after: string): StepperExpression  {
    return new StepperBinaryExpression(this.operator, 
        this.left.rename(before, after), this.right.rename(before, after));
  }
}
