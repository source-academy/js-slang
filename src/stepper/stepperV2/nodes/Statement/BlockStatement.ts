import { BlockStatement } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, undefinedNode } from '..'
import { StepperStatement } from '.'
import { convert } from '../../generator'
import { redex, SubstitutionScope } from '../..'
import { StepperIdentifier } from '../Expression/Identifier'

export class StepperBlockStatement implements BlockStatement, StepperBaseNode {
  type: 'BlockStatement'
  body: StepperStatement[]

  constructor(body: StepperStatement[]) {
    this.type = 'BlockStatement'
    this.body = body
  }

  static create(node: BlockStatement) {
    return new StepperBlockStatement(node.body.map(ast => convert(ast) as StepperStatement))
  }

  isContractible(): boolean {
    return true;
  }

  isOneStepPossible(): boolean {
    return true;
  }

  contract(): StepperBlockStatement | StepperStatement | typeof undefinedNode {
    if (this.body.length === 0) {
      redex.preRedex = [this]
      redex.postRedex = []
      return undefinedNode;
    }
    if (this.body.length === 1) {
      redex.preRedex = [this]
      redex.postRedex = [this.body[0]]g
      return this.body[0];
    }
    // V1; V2; -> {}, V2; -> V2;
    this.body[0].contractEmpty()
    return new StepperBlockStatement(this.body.slice(1))
  }

  oneStep(): StepperBlockStatement | StepperStatement | typeof undefinedNode {
    if (this.body.length == 0) {
      return this.contract();
    }

    if (this.body[0].isOneStepPossible()) {
      SubstitutionScope.set(this.body.slice(1))
      const firstStatementOneStep = this.body[0].oneStep()
      const afterSubstitutedScope = SubstitutionScope.get()
      SubstitutionScope.reset()
      if (firstStatementOneStep === undefinedNode) {
        return new StepperBlockStatement([afterSubstitutedScope].flat())
      }
      return new StepperBlockStatement(
        [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      )
    }

    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
      // V; E; -> V; E';
      SubstitutionScope.set(this.body.slice(2))
      const secondStatementOneStep = this.body[1].oneStep()
      const afterSubstitutedScope = SubstitutionScope.get()
      SubstitutionScope.reset()
      if (secondStatementOneStep === undefinedNode) {
        return new StepperBlockStatement([this.body[0], afterSubstitutedScope].flat())
      }
      return new StepperBlockStatement(
        [this.body[0], secondStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      )
    }

    return this.contract()
  }

  // TODO: Scan local names
  substitute(id: StepperIdentifier, value: StepperExpression): StepperBaseNode {
    return new StepperBlockStatement(
      this.body.map(statement => statement.substitute(id, value) as StepperStatement)
    )
  }
}
