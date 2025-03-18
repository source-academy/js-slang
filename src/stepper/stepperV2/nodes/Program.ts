import { Comment, Program, SourceLocation } from 'estree'
import { StepperBaseNode } from '../interface'
import { convert } from '../generator'
import { StepperStatement } from './Statement'
import { StepperExpression, StepperPattern, undefinedNode } from '.'
import { SubstitutionScope } from '..'
import {
  StepperVariableDeclaration,
  StepperVariableDeclarator
} from './Statement/VariableDeclaration'

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
    if (this.body.length <= 1) {
      return this.body[0].isContractible()
    } else {
      return true
    }
  }

  isOneStepPossible(): boolean {
    return this.body.length === 0 || this.body[0].isOneStepPossible() || this.body.length >= 2
  }

  contract(): StepperProgram | typeof undefinedNode {
    // V1; V2; -> {}, V2; -> V2;
    this.body[0].contractEmpty() // update the contracted statement onto redex
    return new StepperProgram(this.body.slice(1))
  }

  oneStep(): StepperProgram | typeof undefinedNode {
    if (this.body.length == 0) {
      return undefinedNode
    }

    if (this.body[0].isOneStepPossible()) {
      SubstitutionScope.set(this.body.slice(1))
      const firstStatementOneStep = this.body[0].oneStep()
      const afterSubstitutedScope = SubstitutionScope.get()
      SubstitutionScope.reset()
      if (firstStatementOneStep === undefinedNode) {
        return new StepperProgram([afterSubstitutedScope].flat())
      }
      return new StepperProgram(
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
        return new StepperProgram([this.body[0], afterSubstitutedScope].flat())
      }
      return new StepperProgram(
        [this.body[0], secondStatementOneStep as StepperStatement, afterSubstitutedScope].flat()
      )
    }

    return this.contract()
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
      .filter(ast => ast.type === 'VariableDeclaration')
      .flatMap((ast: StepperVariableDeclaration) => ast.declarations)
      .map((ast: StepperVariableDeclarator) => ast.id.name)
  }

  freeNames(): string[] {
    const names = new Set(this.body.flatMap(ast => ast.freeNames()))
    this.scanAllDeclarationNames().forEach(name => names.delete(name))
    return Array.from(names)
  }

  rename(before: string, after: string): StepperProgram {
    return new StepperProgram(
      this.body.map(statement => statement.rename(before, after) as StepperStatement)
    )
  }
}
