import type { Comment, IfStatement, SourceLocation } from 'estree'
import { type StepperExpression, type StepperPattern, undefinedNode } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { StepperLiteral } from '../Expression/Literal'
import { StepperBlockStatement } from './BlockStatement'
import { StepperExpressionStatement } from './ExpressionStatement'
import type { StepperStatement } from '.'

export class StepperIfStatement extends StepperBaseNode<IfStatement> implements IfStatement {
  constructor(
    public readonly test: StepperExpression,
    public readonly consequent: StepperStatement,
    public readonly alternate: StepperStatement | null,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('IfStatement', leadingComments, trailingComments, loc, range)
  }

  static create(node: IfStatement) {
    return new StepperIfStatement(
      convert(node.test) as StepperExpression,
      convert(node.consequent) as StepperBlockStatement,
      node.alternate ? (convert(node.alternate) as StepperBlockStatement) : null,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  public override isContractible(): boolean {
    return this.test instanceof StepperLiteral
  }

  public override contract(): StepperBlockStatement | StepperIfStatement {
    if (!(this.test instanceof StepperLiteral)) {
      throw new Error('Cannot contract non-literal test')
    }

    redex.preRedex = [this]
    const result = this.test.value ? this.consequent : this.alternate || undefinedNode

    if (result instanceof StepperBlockStatement) {
      redex.postRedex = [result]
      return new StepperBlockStatement(
        [
          new StepperExpressionStatement(undefinedNode, undefined, undefined, this.loc, this.range),
          ...result.body
        ],
        result.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    } else if (result instanceof StepperIfStatement) {
      // else if statement
      return result
    } else {
      throw new Error('Cannot contract to non-block statement')
    }
  }

  public override isOneStepPossible(): boolean {
    return this.isContractible() || this.test.isOneStepPossible()
  }

  public override oneStep(): StepperIfStatement | StepperBlockStatement {
    if (!this.isOneStepPossible()) {
      throw new Error('No step possible in test')
    }

    if (this.isContractible()) {
      return this.contract()
    }

    return new StepperIfStatement(
      this.test.oneStep(),
      this.consequent,
      this.alternate,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperIfStatement(
      this.test.substitute(id, value),
      this.consequent.substitute(id, value) as StepperStatement,
      this.alternate ? (this.alternate.substitute(id, value) as StepperStatement) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override freeNames(): string[] {
    const names = new Set([
      ...this.test.freeNames(),
      ...this.consequent.freeNames(),
      ...(this.alternate ? this.alternate.freeNames() : [])
    ])
    return Array.from(names)
  }

  public override allNames(): string[] {
    const names = new Set([
      ...this.test.allNames(),
      ...this.consequent.allNames(),
      ...(this.alternate ? this.alternate.allNames() : [])
    ])
    return Array.from(names)
  }

  public override rename(before: string, after: string): StepperIfStatement {
    return new StepperIfStatement(
      this.test.rename(before, after),
      this.consequent.rename(before, after) as StepperStatement,
      this.alternate ? (this.alternate.rename(before, after) as StepperStatement) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
