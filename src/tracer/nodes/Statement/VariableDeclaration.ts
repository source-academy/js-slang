import { Comment, SourceLocation, VariableDeclaration, VariableDeclarator } from 'estree'
import { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { redex } from '../..'

export class StepperVariableDeclarator implements VariableDeclarator, StepperBaseNode {
  type: 'VariableDeclarator'
  id: StepperPattern
  init?: StepperExpression | null | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined
  
  constructor(id: StepperPattern, init: StepperExpression | null | undefined,
       leadingComments?: Comment[] | undefined,
       trailingComments?: Comment[] | undefined,
       loc?: SourceLocation | null | undefined,
       range?: [number, number] | undefined) {
    this.type = 'VariableDeclarator'
    this.id = id
    this.init = init
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }
  

  static create(node: VariableDeclarator) {
    return new StepperVariableDeclarator(
      convert(node.id) as StepperPattern,
      node.init ? (convert(node.init) as StepperExpression) : node.init,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return this.init ? this.init.isContractible() : false
  }

  isOneStepPossible(): boolean {
    return this.init ? this.init.isOneStepPossible() : false
  }

  contract(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(
      this.id, 
      this.init!.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  oneStep(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(
      this.id, 
      this.init!.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperVariableDeclarator(
      this.id, 
      this.init!.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
  
  freeNames(): string[] {
    return this.init!.freeNames();
  }

  allNames(): string[] {
    return this.init!.allNames();
  }

  rename(before: string, after: string): StepperVariableDeclarator  {
    return new StepperVariableDeclarator(
      this.id.rename(before, after), 
      this.init!.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}

// After all variable declarators have been contracted,
// StepperVariableDeclaration::contract triggers substitution
export class StepperVariableDeclaration implements VariableDeclaration, StepperBaseNode {
  type: 'VariableDeclaration'
  declarations: StepperVariableDeclarator[]
  kind: 'var' | 'let' | 'const'
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(declarations: StepperVariableDeclarator[], kind: 'var' | 'let' | 'const', 
    leadingComments?: Comment[] | undefined, 
    trailingComments?: Comment[] | undefined, 
    loc?: SourceLocation | null | undefined, 
    range?: [number, number] | undefined) {
    this.type = 'VariableDeclaration'
    this.declarations = declarations
    this.kind = kind
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }
  

  static create(node: VariableDeclaration) {
    return new StepperVariableDeclaration(
      node.declarations.map(node => convert(node) as StepperVariableDeclarator),
      node.kind,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return false;
  }

  isOneStepPossible(): boolean {
    return this.declarations
      .map(x => x.isOneStepPossible())
      .reduce((acc, next) => acc || next, false);
  }

  contract(): typeof undefinedNode {
    redex.preRedex = [this]
    redex.postRedex = []
    return undefinedNode
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  oneStep(): StepperVariableDeclaration | typeof undefinedNode {
    // Find the one that is not contractible.
    for (let i = 0; i < this.declarations.length; i++) {
      const ast = this.declarations[i]
      if (ast.isOneStepPossible()) {
        return new StepperVariableDeclaration(
          [
            this.declarations.slice(0, i),
            ast.oneStep() as StepperVariableDeclarator,
            this.declarations.slice(i + 1)
          ].flat(),
          this.kind,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
    }

    return this;
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperVariableDeclaration(
      this.declarations.map(
        declaration => declaration.substitute(id, value) as StepperVariableDeclarator
      ),
      this.kind,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  

  freeNames(): string[] {
    return Array.from(new Set(this.declarations.flatMap((ast) => ast.freeNames())));
  }

  allNames(): string[] {
    return Array.from(new Set(this.declarations.flatMap((ast) => ast.allNames())));
  }

  rename(before: string, after: string): StepperVariableDeclaration {
    return new StepperVariableDeclaration(
      this.declarations.map(
        declaration => declaration.rename(before, after) as StepperVariableDeclarator
      ),
      this.kind,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
