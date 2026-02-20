import type { Comment, SourceLocation, UnaryExpression, UnaryOperator } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { checkUnaryExpression } from '../../../utils/rttc'
import assert from '../../../utils/assert'
import { GeneralRuntimeError } from '../../../errors/base'
import { StepperLiteral } from './Literal'

export class StepperUnaryExpression
  extends StepperBaseNode<UnaryExpression>
  implements UnaryExpression
{
  public readonly prefix: true

  constructor(
    public readonly operator: UnaryOperator,
    public readonly argument: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    super('UnaryExpression', leadingComments, trailingComments, loc, range)
    this.prefix = true
  }

  static createLiteral(node: StepperUnaryExpression | UnaryExpression): StepperLiteral | undefined {
    // if node argument is positive literal(x) and node operator is "-", we replace them with literal(-x) instead.
    if (
      node.operator === '-' &&
      node.argument.type === 'Literal' &&
      typeof node.argument.value === 'number' &&
      node.argument.value > 0
    ) {
      return new StepperLiteral(
        -node.argument.value,
        (-node.argument.value).toString(),
        node.leadingComments,
        node.trailingComments,
        node.loc,
        node.range
      )
    }
    return undefined
  }

  static create(node: UnaryExpression) {
    const literal = StepperUnaryExpression.createLiteral(node)
    if (literal) {
      return literal
    }
    return new StepperUnaryExpression(
      node.operator,
      convert(node.argument) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    if (this.argument.type !== 'Literal') return false

    const valueType = typeof this.argument.value
    const markContractible = () => {
      redex.preRedex = [this]
      return true
    }

    const error = checkUnaryExpression(this, this.operator, this.argument.value)
    if (error) {
      throw error
    }

    if (this.operator === '!' && valueType === 'boolean') {
      return markContractible()
    }

    if (this.operator === '-' && valueType === 'number') {
      return markContractible()
    }

    return false
  }

  public override isOneStepPossible(): boolean {
    return this.isContractible() || this.argument.isOneStepPossible()
  }

  public override contract(): StepperLiteral {
    redex.preRedex = [this]

    assert(
      this.argument.type === 'Literal',
      'UnaryExpressions cannot be contracted if the argument is not a Literal'
    )

    const operand = this.argument.value
    switch (this.operator) {
      case '!': {
        const ret = new StepperLiteral(
          !operand,
          (operand as boolean) ? 'false' : 'true',
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
        redex.postRedex = [ret]
        return ret
      }
      case '-': {
        const ret = new StepperLiteral(
          -(operand as number),
          (-(operand as number)).toString(),
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
        redex.postRedex = [ret]
        return ret
      }
      // provide support for the typeof operator to be used in Source Typed
      case 'typeof': {
        const typeValue = typeof operand
        const ret = new StepperLiteral(
          typeValue,
          typeValue,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
        redex.postRedex = [ret]
        return ret
      }
      default:
        throw new GeneralRuntimeError(`Unsupported operator ${this.operator} in tracer`, this)
    }
  }

  public override oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }
    const res = new StepperUnaryExpression(
      this.operator,
      this.argument.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
    const literal = StepperUnaryExpression.createLiteral(res)
    return literal ? literal : res
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    const res = new StepperUnaryExpression(
      this.operator,
      this.argument.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
    const literal = StepperUnaryExpression.createLiteral(res)
    return literal ? literal : res
  }

  public override freeNames(): string[] {
    return this.argument.freeNames()
  }

  public override allNames(): string[] {
    return this.argument.allNames()
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperUnaryExpression(
      this.operator,
      this.argument.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
