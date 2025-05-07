import { BinaryExpression, BinaryOperator, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
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

  constructor(
    operator: BinaryOperator,
    left: StepperExpression,
    right: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
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
      return false
    }

    const leftType = typeof this.left.value
    const rightType = typeof this.right.value

    const markContractible = () => {
      redex.preRedex = [this]
      return true
    }

    if (leftType === 'boolean') {
      throw new Error(
        `Line ${
          this.loc?.start.line || 0
        }: Expected number or string on left hand side of operation, got ${leftType}.`
      )
    }

    if (leftType === 'string' && rightType === 'string') {
      if (['+', '===', '!==', '<', '>', '<=', '>='].includes(this.operator)) {
        return markContractible()
      } else {
        throw new Error(
          `Line ${
            this.loc?.start.line || 0
          }: Expected number on left hand side of operation, got ${leftType}.`
        )
      }
    }

    if (leftType === 'string') {
      if (['+', '===', '!==', '<', '>', '<=', '>='].includes(this.operator)) {
        throw new Error(
          `Line ${
            this.loc?.start.line || 0
          }: Expected string on right hand side of operation, got ${rightType}.`
        )
      } else {
        throw new Error(
          `Line ${
            this.loc?.start.line || 0
          }: Expected number on left hand side of operation, got ${leftType}.`
        )
      }
    }

    if (leftType === 'number' && rightType === 'number') {
      if (['*', '+', '/', '-', '===', '!==', '<', '>', '<=', '>=', '%'].includes(this.operator)) {
        return markContractible()
      }
    }

    if (leftType === 'number') {
      throw new Error(
        `Line ${
          this.loc?.start.line || 0
        }: Expected number on right hand side of operation, got ${rightType}.`
      )
    }

    return false
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

    let ret = new StepperLiteral(
      value,
      value !== null ? value.toString() : 'null',
      undefined,
      undefined,
      this.loc,
      this.range
    )
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
    return new StepperBinaryExpression(
      this.operator,
      this.left.substitute(id, value),
      this.right.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    return Array.from(new Set([this.left.freeNames(), this.right.freeNames()].flat()))
  }

  allNames(): string[] {
    return Array.from(new Set([this.left.allNames(), this.right.allNames()].flat()))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperBinaryExpression(
      this.operator,
      this.left.rename(before, after),
      this.right.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
