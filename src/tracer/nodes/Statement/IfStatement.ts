import { IfStatement } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { StepperStatement } from '.'
import { convert } from '../../generator'
import { redex } from '../..'
import { StepperLiteral } from '../Expression/Literal'
import { StepperBlockStatement } from './BlockStatement'
import { StepperExpressionStatement } from './ExpressionStatement'

export class StepperIfStatement implements IfStatement, StepperBaseNode {
  type: 'IfStatement'
  test: StepperExpression
  consequent: StepperStatement
  alternate: StepperStatement | null

  constructor(test: StepperExpression, consequent: StepperStatement, alternate: StepperStatement | null) {
    this.type = 'IfStatement'
    this.test = test
    this.consequent = consequent
    this.alternate = alternate
  }

  static create(node: IfStatement) {
    return new StepperIfStatement(
      convert(node.test) as StepperExpression,
      convert(node.consequent) as StepperBlockStatement,
      node.alternate ? convert(node.alternate) as StepperBlockStatement : null
    )
  }

  isContractible(): boolean {
    return this.test instanceof StepperLiteral
  }

  contract(): StepperBlockStatement {
    if (!(this.test instanceof StepperLiteral)) {
      throw new Error('Cannot contract non-literal test')
    }

    redex.preRedex = [this]
    const result = this.test.value ? this.consequent : (this.alternate || undefinedNode)
    
    if (result instanceof StepperBlockStatement) {
        redex.postRedex = [result]
        return new StepperBlockStatement([new StepperExpressionStatement(undefinedNode), ...result.body])
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
      this.alternate
    )
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperIfStatement(
      this.test.substitute(id, value) as StepperExpression,
      this.consequent.substitute(id, value) as StepperStatement,
      this.alternate ? this.alternate.substitute(id, value) as StepperStatement : null
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
      this.alternate ? this.alternate.rename(before, after) as StepperStatement : null
    )
  }
}
