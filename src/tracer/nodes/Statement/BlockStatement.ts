import { BlockStatement, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { convert } from '../../generator'
import { redex } from '../..'
import { assignMuTerms, getFreshName } from '../../utils'
import { StepperVariableDeclaration } from './VariableDeclaration'
import { StepperFunctionDeclaration } from './FunctionDeclaration'
import { StepperReturnStatement } from './ReturnStatement'
import { StepperStatement } from '.'

export class StepperBlockStatement implements BlockStatement, StepperBaseNode {
  type: 'BlockStatement'
  body: StepperStatement[]
  innerComments?: Comment[] | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    body: StepperStatement[],
    innerComments?: Comment[] | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'BlockStatement'
    this.body = body
    this.innerComments = innerComments
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: BlockStatement) {
    return new StepperBlockStatement(
      node.body.map(ast => convert(ast) as StepperStatement),
      node.innerComments,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return this.body.length === 0 || (this.body.length === 1 && !this.body[0].isContractible())
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

    throw new Error('Not implemented')
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  oneStep(): StepperBlockStatement | StepperStatement | typeof undefinedNode {
    if (this.isContractible()) {
      return this.contract()
    }

    if (this.body[0].type === 'ReturnStatement') {
      const returnStmt = this.body[0] as StepperReturnStatement
      redex.preRedex = [this]
      redex.postRedex = [returnStmt]
      return returnStmt
    }

    // reduce the first statement
    if (this.body[0].isOneStepPossible()) {
      const firstStatementOneStep = this.body[0].oneStep()
      const afterSubstitutedScope = this.body.slice(1)
      if (firstStatementOneStep === undefinedNode) {
        return new StepperBlockStatement(
          [afterSubstitutedScope].flat(),
          this.innerComments,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
      return new StepperBlockStatement(
        [firstStatementOneStep as StepperStatement, afterSubstitutedScope].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    }

    // If the first statement is constant declaration, gracefully handle it!
    if (this.body[0].type == 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[0].declarations)
      const afterSubstitutedScope = this.body
        .slice(1)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) =>
                statement.substitute(declarator.id, declarator.init!) as StepperStatement,
              current
            )
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.preRedex = [this.body[0]]
      redex.postRedex = declarations.map(x => x.id)
      return substitutedProgram
    }

    // If the first statement is function declaration, also gracefully handle it!
    if (this.body[0].type == 'FunctionDeclaration') {
      const arrowFunction = (
        this.body[0] as StepperFunctionDeclaration
      ).getArrowFunctionExpression()
      const functionIdentifier = (this.body[0] as StepperFunctionDeclaration).id
      const afterSubstitutedScope = this.body
        .slice(1)
        .map(
          statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.preRedex = [this.body[0]]
      redex.postRedex = afterSubstitutedScope
      return substitutedProgram
    }

    const firstValueStatement = this.body[0]
    // After this stage, the first statement is a value statement. Now, proceed until getting the second value statement.
    // if the second statement is return statement, remove the first statement
    if (this.body.length >= 2 && this.body[1].type == 'ReturnStatement') {
      redex.preRedex = [this.body[0]]
      const afterSubstitutedScope = this.body.slice(1)
      redex.postRedex = []
      return new StepperBlockStatement(
        afterSubstitutedScope,
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    }

    if (this.body.length >= 2 && this.body[1].isOneStepPossible()) {
      const secondStatementOneStep = this.body[1].oneStep()
      const afterSubstitutedScope = this.body.slice(2)
      if (secondStatementOneStep === undefinedNode) {
        return new StepperBlockStatement(
          [firstValueStatement, afterSubstitutedScope].flat(),
          this.innerComments,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
      return new StepperBlockStatement(
        [
          firstValueStatement,
          secondStatementOneStep as StepperStatement,
          afterSubstitutedScope
        ].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    }

    // If the second statement is constant declaration, gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == 'VariableDeclaration') {
      const declarations = assignMuTerms(this.body[1].declarations)
      const afterSubstitutedScope = this.body
        .slice(2)
        .map(current =>
          declarations
            .filter(declarator => declarator.init)
            .reduce(
              (statement, declarator) =>
                statement.substitute(declarator.id, declarator.init!) as StepperStatement,
              current
            )
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(
        [firstValueStatement, afterSubstitutedScope].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.preRedex = [this.body[1]]
      redex.postRedex = declarations.map(x => x.id)
      return substitutedProgram
    }

    // If the second statement is function declaration, also gracefully handle it!
    if (this.body.length >= 2 && this.body[1].type == 'FunctionDeclaration') {
      const arrowFunction = (
        this.body[1] as StepperFunctionDeclaration
      ).getArrowFunctionExpression()
      const functionIdentifier = (this.body[1] as StepperFunctionDeclaration).id
      const afterSubstitutedScope = this.body
        .slice(2)
        .map(
          statement => statement.substitute(functionIdentifier, arrowFunction) as StepperStatement
        ) as StepperStatement[]
      const substitutedProgram = new StepperBlockStatement(
        [firstValueStatement, afterSubstitutedScope].flat(),
        this.innerComments,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.preRedex = [this.body[1]]
      redex.postRedex = afterSubstitutedScope
      return substitutedProgram
    }

    // After this stage, we have two value inducing statement. Remove the first one.
    this.body[0].contractEmpty() // update the contracted statement onto redex
    return new StepperBlockStatement(
      this.body.slice(1),
      this.innerComments,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  substitute(
    id: StepperPattern,
    value: StepperExpression,
    upperBoundName?: string[]
  ): StepperBaseNode {
    // Alpha renaming
    // Check whether should be renamed
    // Renaming stage should not be counted as one step.
    const valueFreeNames = value.freeNames()
    const scopeNames = this.scanAllDeclarationNames()
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))
    var currentBlockStatement: StepperBlockStatement = this
    let protectedNamesSet = new Set([this.allNames(), upperBoundName ?? []].flat())
    repeatedNames.forEach(name => protectedNamesSet.delete(name))
    const protectedNames = Array.from(protectedNamesSet)
    const newNames = getFreshName(repeatedNames, protectedNames)
    for (var index in newNames) {
      currentBlockStatement = currentBlockStatement.rename(
        repeatedNames[index],
        newNames[index]
      ) as StepperBlockStatement
    }

    if (currentBlockStatement.scanAllDeclarationNames().includes(id.name)) {
      // DO nothing
      return currentBlockStatement
    }
    return new StepperBlockStatement(
      currentBlockStatement.body.map(
        statement => statement.substitute(id, value) as StepperStatement
      ),
      this.innerComments,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  scanAllDeclarationNames(): string[] {
    return this.body
      .filter(ast => ast.type === 'VariableDeclaration' || ast.type === 'FunctionDeclaration')
      .flatMap((ast: StepperVariableDeclaration | StepperFunctionDeclaration) => {
        if (ast.type === 'VariableDeclaration') {
          return ast.declarations.map(ast => ast.id.name)
        } else {
          // Function Declaration
          return [(ast as StepperFunctionDeclaration).id.name]
        }
      })
  }

  freeNames(): string[] {
    const names = new Set(this.body.flatMap(ast => ast.freeNames()))
    this.scanAllDeclarationNames().forEach(name => names.delete(name))
    return Array.from(names)
  }

  allNames(): string[] {
    return Array.from(new Set(this.body.flatMap(ast => ast.allNames())))
  }

  rename(before: string, after: string): StepperBlockStatement {
    return new StepperBlockStatement(
      this.body.map(statement => statement.rename(before, after) as StepperStatement),
      this.innerComments,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
