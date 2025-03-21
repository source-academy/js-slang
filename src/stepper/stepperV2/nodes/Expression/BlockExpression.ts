import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { convert } from '../../generator'
import { redex, SubstitutionScope } from '../..'
import { StepperVariableDeclaration, StepperVariableDeclarator } from '../Statement/VariableDeclaration'
import { getFreshName } from '../../utils'
import { StepperReturnStatement } from '../Statement/ReturnStatement'
import { StepperStatement } from '../Statement'
import {  BlockStatement } from 'estree'

// TODO: add docs, because this is a block expression, not a block statement, and this does not follow official estree spec
export class StepperBlockExpression implements StepperBaseNode {
  type: 'BlockStatement'
  body: StepperStatement[]

  constructor(body: StepperStatement[]) {
    this.type = 'BlockStatement'
    this.body = body
  }

  static create(node: BlockStatement) {
    return new StepperBlockExpression(node.body.map(ast => convert(ast) as StepperStatement))
  }

  isContractible(): boolean {
    return this.body.length === 0 || (this.body[0].type === 'ReturnStatement' && this.body[0].isContractible())
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.body[0].isOneStepPossible()
  }

  contract(): StepperExpression | typeof undefinedNode {
    if (this.body.length === 0) {
      redex.preRedex = [this];
      redex.postRedex = [];
      return undefinedNode;
    }

    if (this.body[0].type === 'ReturnStatement' && this.body[0].isContractible()) {
      const returnStmt = this.body[0] as StepperReturnStatement;
      return returnStmt.argument || undefinedNode;
    }

    throw new Error('Cannot contract block expression')
  }

  oneStep(): StepperBlockExpression | typeof undefinedNode | StepperExpression {
    if (this.isContractible()) {
      return this.contract();
    }

    if (this.body[0].isOneStepPossible()) {
      SubstitutionScope.set(this.body.slice(1));
      const firstStatementOneStep = this.body[0].oneStep();
      const afterSubstitutedScope = SubstitutionScope.get();
      SubstitutionScope.reset();
      if (firstStatementOneStep === undefinedNode) {
        return new StepperBlockExpression([afterSubstitutedScope].flat());
      }
      return new StepperBlockExpression(
        [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      );
    }

    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
      SubstitutionScope.set(this.body.slice(2));
      const secondStatementOneStep = this.body[1].oneStep();
      const afterSubstitutedScope = SubstitutionScope.get();
      SubstitutionScope.reset();
      if (secondStatementOneStep === undefinedNode) {
        return new StepperBlockExpression([this.body[0], afterSubstitutedScope].flat());
      }
      return new StepperBlockExpression(
        [this.body[0], secondStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      );
    }

    return this.contract();
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBlockExpression {
    const valueFreeNames = value.freeNames();
    const scopeNames = this.scanAllDeclarationNames();
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name));
    let currentBlockExpression: StepperBlockExpression = this;
    for (const name of repeatedNames) {
      currentBlockExpression = currentBlockExpression.rename(name, getFreshName(name)) as StepperBlockExpression;
    }

    if (currentBlockExpression.scanAllDeclarationNames().includes(id.name)) {
      return currentBlockExpression;
    }
    return new StepperBlockExpression(
      currentBlockExpression.body.map(statement => statement.substitute(id, value) as StepperStatement)
    );
  }

  scanAllDeclarationNames(): string[] {
    return this.body
      .filter(ast => ast.type === 'VariableDeclaration')
      .flatMap((ast: StepperVariableDeclaration) => ast.declarations)
      .map((ast: StepperVariableDeclarator) => ast.id.name);
  }

  freeNames(): string[] {
    const names = new Set(this.body.flatMap((ast) => ast.freeNames()));
    this.scanAllDeclarationNames().forEach(name => names.delete(name));
    return Array.from(names);
  }

  rename(before: string, after: string): StepperBlockExpression {
    return new StepperBlockExpression(
      this.body.map(statement => statement.rename(before, after) as StepperStatement)
    );
  }
}
