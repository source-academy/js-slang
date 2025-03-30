import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { convert } from '../../generator'
import { redex } from '../..'
import { StepperVariableDeclaration, StepperVariableDeclarator } from '../Statement/VariableDeclaration'
import { assignMuTerms, getFreshName } from '../../utils'
import { StepperReturnStatement } from '../Statement/ReturnStatement'
import { StepperStatement } from '../Statement'
import {  BlockStatement } from 'estree'
import { StepperFunctionDeclaration } from '../Statement/FunctionDeclaration'

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
    return this.body.length === 0 
    || (this.body.length === 1 && !this.body[0].isOneStepPossible()) // { 1; } -> undefined;
    || (this.body[0].type === 'ReturnStatement' && this.body[0].isContractible())
    
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.body[0].isOneStepPossible() || 
    (this.body.length >= 2)
  }

  contract(): StepperExpression | typeof undefinedNode {
    if (this.body.length === 0 || (this.body.length === 1 && !this.body[0].isOneStepPossible())) {
      redex.preRedex = [this];
      redex.postRedex = [];
      return undefinedNode;
    }

    if (this.body[0].type === 'ReturnStatement' && this.body[0].isContractible()) {
      const returnStmt = this.body[0] as StepperReturnStatement;
      returnStmt.contract();
      return returnStmt.argument || undefinedNode;
    }
    throw new Error('Cannot contract block expression')
  }

  oneStep(): StepperBlockExpression | typeof undefinedNode | StepperExpression {
    if (this.isContractible()) {
      return this.contract();
    }

    // reduce the first statement
    if (this.body[0].isOneStepPossible()) {
        const firstStatementOneStep = this.body[0].oneStep()
        const afterSubstitutedScope = this.body.slice(1);
        if (firstStatementOneStep === undefinedNode) {
          return new StepperBlockExpression([afterSubstitutedScope].flat())
        }
        return new StepperBlockExpression(
          [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
        )
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type == "VariableDeclaration") {
      const declarations = assignMuTerms(this.body[0].declarations);
      const afterSubstitutedScope = this.body.slice(1).map(
        (current) => declarations.filter(declarator => declarator.init).reduce(
        (statement, declarator) => statement.substitute(declarator.id, declarator.init!) as StepperStatement, current
      )) as StepperStatement[];
      const substitutedProgram  = new StepperBlockExpression(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = declarations.map(x => x.id);
      return substitutedProgram;
    }

    // If the first statement is function declaration, also gracefully handle it!
    if (this.body[0].type == "FunctionDeclaration") {
      const arrowFunction = (this.body[0] as StepperFunctionDeclaration).getArrowFunctionExpression();
      const functionIdentifier = (this.body[0] as StepperFunctionDeclaration).id;
      const afterSubstitutedScope = this.body.slice(1)
        .map(statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement) as StepperStatement[];
      const substitutedProgram  = new StepperBlockExpression(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    const firstValueStatement = this.body[0];
    
    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.
    
    // if the second statement is return statement, ignore the first statement
    if (this.body.length >= 2 && this.body[1].type == "ReturnStatement") {
      redex.preRedex = [this.body[0]];
      const afterSubstitutedScope = this.body.slice(1);
      redex.postRedex = []; 
      return new StepperBlockExpression(afterSubstitutedScope);
    } 

    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
        const secondStatementOneStep = this.body[1].oneStep()
        const afterSubstitutedScope = this.body.slice(2);
        if (secondStatementOneStep === undefinedNode) {
          return new StepperBlockExpression([firstValueStatement, afterSubstitutedScope].flat())
        }
        return new StepperBlockExpression(
          [firstValueStatement, secondStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
        ) 
    }

    // If the second statement is constant declaration, gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == "VariableDeclaration") {
      const declarations = assignMuTerms(this.body[1].declarations);
      const afterSubstitutedScope = this.body.slice(2).map(
        (current) => declarations.filter(declarator => declarator.init).reduce(
        (statement, declarator) => statement.substitute(declarator.id, declarator.init!) as StepperStatement, current
      )) as StepperStatement[];
      const substitutedProgram  = new StepperBlockExpression([firstValueStatement, afterSubstitutedScope].flat());
      redex.preRedex = [this.body[1]];
      redex.postRedex = declarations.map(x => x.id);
      return substitutedProgram;
    }

    // If the second statement is function declaration, also gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == "FunctionDeclaration") {
      const arrowFunction = (this.body[1] as StepperFunctionDeclaration).getArrowFunctionExpression();
      const functionIdentifier = (this.body[1] as StepperFunctionDeclaration).id;
      const afterSubstitutedScope = this.body.slice(1)
        .map(statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement) as StepperStatement[];
      const substitutedProgram  = new StepperBlockExpression([firstValueStatement, afterSubstitutedScope].flat());
      redex.preRedex = [this.body[1]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    // After this stage, we have two value inducing statement. Remove the first one.
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
