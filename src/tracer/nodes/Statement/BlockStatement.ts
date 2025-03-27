import { BlockStatement } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { StepperStatement } from '.'
import { convert } from '../../generator'
import { redex } from '../..'
import { StepperVariableDeclaration, StepperVariableDeclarator } from './VariableDeclaration'
import { assignMuTerms, getFreshName } from '../../utils'

export class StepperBlockStatement implements BlockStatement, StepperBaseNode {
  type: 'BlockStatement'
  body: StepperStatement[]
  leadingComments: any

  constructor(body: StepperStatement[]) {
    this.type = 'BlockStatement'
    this.body = body
  }

  static create(node: BlockStatement) {
    return new StepperBlockStatement(node.body.map(ast => convert(ast) as StepperStatement))
  }

  isContractible(): boolean {
    return true
  }

  isOneStepPossible(): boolean {
    return true
  }

  contract(): StepperBlockStatement | StepperStatement | typeof undefinedNode {
    if (this.body.length === 0) {
      redex.preRedex = [this]
      redex.postRedex = []
      return undefinedNode
    }
    if (this.body.length === 1) {
      redex.preRedex = [this]
      redex.postRedex = [this.body[0]]
      return this.body[0]
    }
    // V1; V2; -> {}, V2; -> V2;
    this.body[0].contractEmpty()
    return new StepperBlockStatement(this.body.slice(1))
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  oneStep(): StepperBlockStatement | StepperStatement | typeof undefinedNode {
    if (this.body.length == 0) {
      return this.contract()
    }

    // reduce the first statement
    if (this.body[0].isOneStepPossible()) {
      const firstStatementOneStep = this.body[0].oneStep()
      const afterSubstitutedScope = this.body.slice(1)
      if (firstStatementOneStep === undefinedNode) {
        return new StepperBlockStatement([afterSubstitutedScope].flat())
      }
      return new StepperBlockStatement(
        [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      )
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type == 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[0].declarations);
      const afterSubstitutedScope = this.body
        .slice(1)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) => statement.substitute(declarator.id, declarator.init!),
              current
            )
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(afterSubstitutedScope)
      redex.preRedex = [this.body[0]]
      redex.postRedex = declarations.map(x => x.id)
      return substitutedProgram
    }

    const firstValueStatement = this.body[0]
    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.
    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
      const secondStatementOneStep = this.body[1].oneStep()
      const afterSubstitutedScope = this.body.slice(2)
      if (secondStatementOneStep === undefinedNode) {
        return new StepperBlockStatement([firstValueStatement, afterSubstitutedScope].flat())
      }
      return new StepperBlockStatement(
        [
          firstValueStatement,
          secondStatementOneStep as StepperStatement,
          afterSubstitutedScope
        ].flat()
      )
    }

    // If the second statement is constant declaration, gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[1].declarations);
      const afterSubstitutedScope = this.body
        .slice(2)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) => statement.substitute(declarator.id, declarator.init!),
              current
            )
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(
        [firstValueStatement, afterSubstitutedScope].flat()
      )
      redex.preRedex = [this.body[1]]
      redex.postRedex = declarations.map(x => x.id)
      return substitutedProgram
    }
    // After this stage, we have two value inducing statement. Remove the first one.

    return this.contract()
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    // Alpha renaming
    // Check whether should be renamed
    // Renaming stage should not be counted as one step.
    const valueFreeNames = value.freeNames()
    const scopeNames = this.scanAllDeclarationNames()
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))
    var currentBlockStatement: StepperBlockStatement = this
    for (var index in repeatedNames) {
      const name = repeatedNames[index]
      currentBlockStatement = currentBlockStatement.rename(
        name,
        getFreshName(name)
      ) as StepperBlockStatement
    }

    if (currentBlockStatement.scanAllDeclarationNames().includes(id.name)) {
      // DO nothing
      return currentBlockStatement
    }
    return new StepperBlockStatement(
      currentBlockStatement.body.map(
        statement => statement.substitute(id, value) as StepperStatement
      )
    )
  }

  scanAllDeclarationNames(): string[] {
    return this.body
      .filter(ast => ast.type === 'VariableDeclaration')
      .flatMap((ast: StepperVariableDeclaration) => ast.declarations)
      .map((ast: StepperVariableDeclarator) => ast.id.name)
  }

  freeNames(): string[] {
    const names = new Set(this.body.flatMap(ast => ast.freeNames()))
    this.scanAllDeclarationNames().forEach(name => names.delete(name))
    return Array.from(names)
  }

  rename(before: string, after: string): StepperBlockStatement {
    return new StepperBlockStatement(
      this.body.map(statement => statement.rename(before, after) as StepperStatement)
    )
  }
}
