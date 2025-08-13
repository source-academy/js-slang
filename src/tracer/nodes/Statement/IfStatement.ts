import type { Comment, IfStatement, SourceLocation } from 'estree'
import { type StepperExpression, type StepperPattern, undefinedNode } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import type { StepperBaseNode } from '../../interface'
import { StepperLiteral } from '../Expression/Literal'
import { StepperBlockStatement } from './BlockStatement'
import { StepperExpressionStatement } from './ExpressionStatement'
import type { StepperStatement } from '.'

export class StepperIfStatement implements IfStatement, StepperBaseNode {
  type: 'IfStatement'
  test: StepperExpression
  consequent: StepperStatement
  alternate: StepperStatement | null

  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    test: StepperExpression,
    consequent: StepperStatement,
    alternate: StepperStatement | null,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'IfStatement'
    this.test = test
    this.consequent = consequent
    this.alternate = alternate
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
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

  isContractible(): boolean {
    return this.test instanceof StepperLiteral
  }

  contract(): StepperBlockStatement | StepperIfStatement {
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

  isOneStepPossible(): boolean {
    return this.isContractible() || this.test.isOneStepPossible()
  }

  oneStep(): StepperIfStatement | StepperBlockStatement {
    if (!this.isOneStepPossible()) {
      throw new Error('No step possible in test')
    }

    if (this.isContractible()) {
      return this.contract()
    }

    return new StepperIfStatement(
      this.test.oneStep() as StepperExpression,
      this.consequent,
      this.alternate,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperIfStatement(
      this.test.substitute(id, value) as StepperExpression,
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

  freeNames(): string[] {
    const names = new Set([
      ...this.test.freeNames(),
      ...this.consequent.freeNames(),
      ...(this.alternate ? this.alternate.freeNames() : [])
    ])
    return Array.from(names)
  }

  allNames(): string[] {
    const names = new Set([
      ...this.test.allNames(),
      ...this.consequent.allNames(),
      ...(this.alternate ? this.alternate.allNames() : [])
    ])
    return Array.from(names)
  }

  rename(before: string, after: string): StepperIfStatement {
    return new StepperIfStatement(
      this.test.rename(before, after) as StepperExpression,
      this.consequent.rename(before, after) as StepperStatement,
      this.alternate ? (this.alternate.rename(before, after) as StepperStatement) : null,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
