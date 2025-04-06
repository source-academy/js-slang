import { Comment, Program, SourceLocation } from 'estree'
import { StepperBaseNode } from '../interface'
import { convert } from '../generator'
import { StepperStatement } from './Statement'
import { StepperExpression, StepperPattern, undefinedNode } from '.'

import {
  StepperVariableDeclaration
} from './Statement/VariableDeclaration'
import { redex } from '..'
import { assignMuTerms } from '../utils'
import { StepperFunctionDeclaration } from './Statement/FunctionDeclaration'

export class StepperProgram implements Program, StepperBaseNode {
  type: 'Program'
  sourceType: 'script' | 'module'
  body: StepperStatement[]
  comments?: Comment[] | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  isContractible(): boolean {
    return false;
  }

  isOneStepPossible(): boolean {
    return this.body.length === 0
      ? false  // unlike BlockStatement 
      : this.body[0].isOneStepPossible() 
      || this.body.length >= 2 
      || (this.body.length == 1 && 
        (this.body[0].type == "VariableDeclaration" || this.body[0].type == "FunctionDeclaration"))
  }

  contract(): StepperProgram  {
    throw new Error("not implemented");
  }

  oneStep(): StepperProgram {
    // reduce the first statement
    if (this.body[0].isOneStepPossible()) {
        const firstStatementOneStep = this.body[0].oneStep()
        const afterSubstitutedScope = this.body.slice(1);
        if (firstStatementOneStep === undefinedNode) {
          return new StepperProgram([afterSubstitutedScope].flat())
        }
        return new StepperProgram(
          [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
        )
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type == "VariableDeclaration") {
      const declarations = assignMuTerms(this.body[0].declarations); // for arrow function expression
      const afterSubstitutedScope = this.body.slice(1).map(
        (current) => declarations.filter(declarator => declarator.init).reduce(
        (statement, declarator) => statement.substitute(declarator.id, declarator.init!) as StepperStatement, current
      )) as StepperStatement[];
      const substitutedProgram  = new StepperProgram(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    // If the first statement is function declaration, also gracefully handle it!
    if (this.body[0].type == "FunctionDeclaration") {
      const arrowFunction = (this.body[0] as StepperFunctionDeclaration).getArrowFunctionExpression();
      const functionIdentifier = (this.body[0] as StepperFunctionDeclaration).id;
      const afterSubstitutedScope = this.body.slice(1)
        .map(statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement) as StepperStatement[];
      const substitutedProgram  = new StepperProgram(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    const firstValueStatement = this.body[0];
    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.
    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
        const secondStatementOneStep = this.body[1].oneStep()
        const afterSubstitutedScope = this.body.slice(2);
        if (secondStatementOneStep === undefinedNode) {
          return new StepperProgram([firstValueStatement, afterSubstitutedScope].flat())
        }
        return new StepperProgram(
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
      const substitutedProgram  = new StepperProgram([firstValueStatement, afterSubstitutedScope].flat());
      redex.preRedex = [this.body[1]];
      redex.postRedex = declarations.map(x => x.id);
      return substitutedProgram;
    }
    
    // If the second statement is function declaration, also gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == "FunctionDeclaration") {
      const arrowFunction = (this.body[1] as StepperFunctionDeclaration).getArrowFunctionExpression();
      const functionIdentifier = (this.body[1] as StepperFunctionDeclaration).id;
      const afterSubstitutedScope = this.body.slice(2)
        .map(statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement) as StepperStatement[];
      const substitutedProgram  = new StepperProgram([firstValueStatement, afterSubstitutedScope].flat());
      redex.preRedex = [this.body[1]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    this.body[0].contractEmpty() // update the contracted statement onto redex
    return new StepperProgram(this.body.slice(1))
  }

  static create(node: Program) {
    return new StepperProgram(
      node.body.map(ast => convert(ast) as StepperStatement),
      node.comments,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  constructor(
    body: StepperStatement[], // TODO: Add support for variable declaration
    comments?: Comment[] | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'Program'
    this.sourceType = 'module'
    this.body = body
    this.comments = comments
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperProgram(
      this.body.map(statement => statement.substitute(id, value) as StepperStatement)
    )
  }

  scanAllDeclarationNames(): string[] {
    return this.body
      .filter(ast => ast.type === 'VariableDeclaration' || ast.type === 'FunctionDeclaration')
      .flatMap((ast: StepperVariableDeclaration | StepperFunctionDeclaration) => {
        if (ast.type === 'VariableDeclaration') {
          return ast.declarations.map(ast => ast.id.name);
        } else { // Function Declaration
          return [(ast as StepperFunctionDeclaration).id.name];
        }
      })
  }

  freeNames(): string[] {
    const names = new Set(this.body.flatMap(ast => ast.freeNames()))
    this.scanAllDeclarationNames().forEach(name => names.delete(name))
    return Array.from(names)
  }

  allNames(): string[] {
     return Array.from(new Set(this.body.flatMap((ast) => ast.allNames())));
  }

  rename(before: string, after: string): StepperProgram {
    return new StepperProgram(
      this.body.map(statement => statement.rename(before, after) as StepperStatement)
    )
  }
}
