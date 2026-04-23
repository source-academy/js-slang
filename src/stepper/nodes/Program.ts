import type { Comment, Program, SourceLocation, Statement } from 'estree';
import { convert } from '../generator';
import { StepperBaseNode } from '../interface';

import { assignMuTerms } from '../utils';
import type { RedexInfo } from '..';
import { InternalRuntimeError } from '../../errors/base';
import { StepperStatement } from './Statement';
import type { StepperFunctionDeclaration } from './Statement/FunctionDeclaration';
import type { StepperVariableDeclaration } from './Statement/VariableDeclaration';
import { type StepperExpression, type StepperPattern, undefinedNode } from '.';

export class StepperProgram extends StepperBaseNode<Program> implements Program {
  public readonly sourceType: 'script' | 'module';

  constructor(
    public readonly body: StepperStatement[], // TODO: Add support for variable declaration
    public readonly comments?: Comment[] | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined,
  ) {
    super('Program', leadingComments, trailingComments, loc, range);
    this.sourceType = 'module';
  }

  public override isContractible(): boolean {
    return false;
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return this.body.length === 0
      ? false // unlike BlockStatement
      : this.body[0].isOneStepPossible(redex) ||
          this.body.length >= 2 ||
          (this.body.length === 1 &&
            (this.body[0].type === 'VariableDeclaration' ||
              this.body[0].type === 'FunctionDeclaration'));
  }

  public override contract(): StepperProgram {
    throw new InternalRuntimeError('contract not implemented for Program', this);
  }

  public override oneStep(redex: RedexInfo): StepperProgram {
    // reduce the first statement
    if (this.body[0].isOneStepPossible(redex)) {
      const firstStatementOneStep = this.body[0].oneStep(redex);
      const afterSubstitutedScope = this.body.slice(1);
      if (firstStatementOneStep === undefinedNode) {
        return new StepperProgram([afterSubstitutedScope].flat());
      }
      return new StepperProgram(
        [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat(),
      );
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type === 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[0].declarations); // for arrow function expression
      const afterSubstitutedScope = this.body
        .slice(1)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) =>
                statement.substitute(declarator.id, declarator.init!, redex) as StepperStatement,
              current,
            ),
        );
      const substitutedProgram = new StepperProgram(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    // If the first statement is function declaration, also gracefully handle it!
    if (this.body[0].type === 'FunctionDeclaration') {
      const arrowFunction = this.body[0].getArrowFunctionExpression();
      const functionIdentifier = this.body[0].id;
      const afterSubstitutedScope = this.body
        .slice(1)
        .map(
          statement =>
            statement.substitute(functionIdentifier, arrowFunction, redex) as StepperStatement,
        );
      const substitutedProgram = new StepperProgram(afterSubstitutedScope);
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    const firstValueStatement = this.body[0];
    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.
    if (this.body.length >= 2 && this.body[1].isOneStepPossible(redex)) {
      const secondStatementOneStep = this.body[1].oneStep(redex);
      const afterSubstitutedScope = this.body.slice(2);
      if (secondStatementOneStep === undefinedNode) {
        return new StepperProgram([firstValueStatement, afterSubstitutedScope].flat());
      }
      return new StepperProgram(
        [
          firstValueStatement,
          secondStatementOneStep as StepperStatement,
          afterSubstitutedScope,
        ].flat(),
      );
    }

    // If the second statement is constant declaration, gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type === 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[1].declarations);
      const afterSubstitutedScope = this.body
        .slice(2)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) =>
                statement.substitute(declarator.id, declarator.init!, redex) as StepperStatement,
              current,
            ),
        );
      const substitutedProgram = new StepperProgram(
        [firstValueStatement, afterSubstitutedScope].flat(),
      );
      redex.preRedex = [this.body[1]];
      redex.postRedex = declarations.map(x => x.id);
      return substitutedProgram;
    }

    // If the second statement is function declaration, also gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type === 'FunctionDeclaration') {
      const arrowFunction = this.body[1].getArrowFunctionExpression();
      const functionIdentifier = this.body[1].id;
      const afterSubstitutedScope = this.body
        .slice(2)
        .map(
          statement =>
            statement.substitute(functionIdentifier, arrowFunction, redex) as StepperStatement,
        );
      const substitutedProgram = new StepperProgram(
        [firstValueStatement, afterSubstitutedScope].flat(),
      );
      redex.preRedex = [this.body[1]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    this.body[0].contractEmpty(redex); // update the contracted statement onto redex
    return new StepperProgram(this.body.slice(1));
  }

  static create(node: Program) {
    return new StepperProgram(
      node.body.map(ast => convert(ast as Statement)),
      node.comments,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range,
    );
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperBaseNode {
    return new StepperProgram(
      this.body.map(statement => statement.substitute(id, value, redex) as StepperStatement),
    );
  }

  scanAllDeclarationNames(): string[] {
    return this.body
      .filter(ast => ast.type === 'VariableDeclaration' || ast.type === 'FunctionDeclaration')
      .flatMap((ast: StepperVariableDeclaration | StepperFunctionDeclaration) => {
        if (ast.type === 'VariableDeclaration') {
          return ast.declarations.map(ast => ast.id.name);
        } else {
          // Function Declaration
          return [ast.id.name];
        }
      });
  }

  public override freeNames(): string[] {
    const names = new Set(this.body.flatMap(ast => ast.freeNames()));
    this.scanAllDeclarationNames().forEach(name => names.delete(name));
    return Array.from(names);
  }

  public override allNames(): string[] {
    return Array.from(new Set(this.body.flatMap(ast => ast.allNames())));
  }

  public override rename(before: string, after: string): StepperProgram {
    return new StepperProgram(
      this.body.map(statement => statement.rename(before, after) as StepperStatement),
    );
  }
}
