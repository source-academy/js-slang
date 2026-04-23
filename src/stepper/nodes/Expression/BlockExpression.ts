import type { BlockStatement, Comment, SourceLocation } from 'estree';
import { type StepperExpression, type StepperPattern, undefinedNode } from '..';
import { convert } from '../../generator';
import { StepperBaseNode } from '../../interface';
import { assignMuTerms, getFreshName } from '../../utils';
import type { StepperStatement } from '../Statement';
import type { RedexInfo } from '../..';
import { InternalRuntimeError } from '../../../errors/base';

// TODO: add docs, because this is a block expression, not a block statement, and this does not follow official estree spec
export class StepperBlockExpression extends StepperBaseNode<BlockStatement> {
  constructor(
    public readonly body: StepperStatement[],
    public readonly innerComments?: Comment[] | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined,
  ) {
    super('BlockStatement', leadingComments, trailingComments, loc, range);
  }

  static create(node: BlockStatement) {
    return new StepperBlockExpression(node.body.map(node => convert(node)));
  }

  public override isContractible(redex: RedexInfo): boolean {
    return (
      this.body.length === 0 ||
      (this.body.length === 1 && !this.body[0].isOneStepPossible(redex)) || // { 1; } -> undefined;
      this.body[0].type === 'ReturnStatement'
    );
  }

  public override isOneStepPossible(redex: RedexInfo): boolean {
    return (
      this.isContractible(redex) || this.body[0].isOneStepPossible(redex) || this.body.length >= 2
    );
  }

  public override contract(redex: RedexInfo): StepperExpression | typeof undefinedNode {
    if (
      this.body.length === 0 ||
      (this.body.length === 1 && !this.body[0].isOneStepPossible(redex))
    ) {
      redex.preRedex = [this];
      redex.postRedex = [];
      return undefinedNode;
    }

    if (this.body[0].type === 'ReturnStatement') {
      const returnStmt = this.body[0];
      returnStmt.contract(redex);
      return returnStmt.argument || undefinedNode;
    }
    throw new InternalRuntimeError('Cannot contract ineligible BlockExpression', this);
  }

  public override oneStep(
    redex: RedexInfo,
  ): StepperBlockExpression | typeof undefinedNode | StepperExpression {
    if (this.isContractible(redex)) {
      return this.contract(redex);
    }
    // reduce the first statement
    if (this.body[0].isOneStepPossible(redex)) {
      const firstStatementOneStep = this.body[0].oneStep(redex);
      const afterSubstitutedScope = this.body.slice(1);
      if (firstStatementOneStep === undefinedNode) {
        return new StepperBlockExpression(
          afterSubstitutedScope,
          this.innerComments,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range,
        );
      }
      return new StepperBlockExpression(
        [firstStatementOneStep as StepperStatement, ...afterSubstitutedScope],
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
      );
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type === 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[0].declarations);
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
      const substitutedProgram = new StepperBlockExpression(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
      );
      redex.preRedex = [this.body[0]];
      redex.postRedex = declarations.map(x => x.id);
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
      const substitutedProgram = new StepperBlockExpression(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
      );
      redex.preRedex = [this.body[0]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    const firstValueStatement = this.body[0];

    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.

    // if the second statement is return statement, remove the first statement
    if (this.body.length >= 2 && this.body[1].type === 'ReturnStatement') {
      redex.preRedex = [this.body[0]];
      const afterSubstitutedScope = this.body.slice(1);
      redex.postRedex = [];
      return new StepperBlockExpression(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
      );
    }

    if (this.body.length >= 2 && this.body[1].isOneStepPossible(redex)) {
      const secondStatementOneStep = this.body[1].oneStep(redex);
      const afterSubstitutedScope = this.body.slice(2);
      if (secondStatementOneStep === undefinedNode) {
        return new StepperBlockExpression(
          [firstValueStatement, afterSubstitutedScope].flat(),
          this.innerComments,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range,
        );
      }
      return new StepperBlockExpression(
        [
          firstValueStatement,
          secondStatementOneStep as StepperStatement,
          afterSubstitutedScope,
        ].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
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
      const substitutedProgram = new StepperBlockExpression(
        [firstValueStatement, afterSubstitutedScope].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
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
      const substitutedProgram = new StepperBlockExpression(
        [firstValueStatement, afterSubstitutedScope].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range,
      );
      redex.preRedex = [this.body[1]];
      redex.postRedex = afterSubstitutedScope;
      return substitutedProgram;
    }

    // After this stage, we have two value inducing statement. Remove the first one.
    this.body[0].contractEmpty(redex); // update the contracted statement onto redex
    return new StepperBlockExpression(
      this.body.slice(1),
      this.innerComments,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }

  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    redex: RedexInfo,
  ): StepperBlockExpression {
    const valueFreeNames = value.freeNames();
    const scopeNames = this.scanAllDeclarationNames();
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name));
    const protectedNamesSet = new Set(this.allNames());
    repeatedNames.forEach(name => protectedNamesSet.delete(name));
    const protectedNames = Array.from(protectedNamesSet);
    const newNames = getFreshName(repeatedNames, protectedNames);

    const currentBlockExpression = newNames.reduce(
      (current: StepperBlockExpression, name: string, index: number) =>
        current.rename(repeatedNames[index], name),
      this,
    );

    if (currentBlockExpression.scanAllDeclarationNames().includes(id.name)) {
      return currentBlockExpression;
    }
    return new StepperBlockExpression(
      currentBlockExpression.body.map(
        statement => statement.substitute(id, value, redex) as StepperStatement,
      ),
      currentBlockExpression.innerComments,
      currentBlockExpression.leadingComments,
      currentBlockExpression.trailingComments,
      currentBlockExpression.loc,
      currentBlockExpression.range,
    );
  }

  scanAllDeclarationNames(): string[] {
    return this.body.flatMap(ast => {
      switch (ast.type) {
        case 'VariableDeclaration':
          return ast.declarations.map(ast => ast.id.name);
        case 'FunctionDeclaration':
          return [ast.id.name];
        default:
          return [];
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

  public override rename(before: string, after: string): StepperBlockExpression {
    return new StepperBlockExpression(
      this.body.map(statement => statement.rename(before, after) as StepperStatement),
      this.innerComments,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range,
    );
  }
}
