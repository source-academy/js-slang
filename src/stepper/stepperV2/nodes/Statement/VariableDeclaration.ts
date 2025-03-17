import { VariableDeclaration, VariableDeclarator } from 'estree'
import { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { redex, SubstitutionScope } from '../..'

export class StepperVariableDeclarator implements VariableDeclarator, StepperBaseNode {
  type: 'VariableDeclarator'
  id: StepperPattern // use estree for convenient
  init?: StepperExpression | null | undefined

  constructor(id: StepperPattern, init: StepperExpression | null | undefined) {
    this.type = 'VariableDeclarator'
    this.id = id
    this.init = init
  }

  static create(node: VariableDeclarator) {
    return new StepperVariableDeclarator(
      convert(node.id) as StepperPattern,
      node.init ? (convert(node.init) as StepperExpression) : node.init
    )
  }

  isContractible(): boolean {
    return this.init ? this.init.isContractible() : false
  }

  isOneStepPossible(): boolean {
    return this.init ? this.init.isOneStepPossible() : false
  }

  contract(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(this.id, this.init!.contract())
  }

  oneStep(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(this.id, this.init!.oneStep())
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperVariableDeclarator(this.id, this.init!.substitute(id, value))
  }
  
  freeNames(): string[] {
    return this.init!.freeNames();
  }

  rename(before: string, after: string): StepperVariableDeclarator  {
    return new StepperVariableDeclarator(this.id.rename(before, after), this.init!.rename(before, after))
  }
}

// After all variable declarators have been contracted,
// StepperVariableDeclaration::contract triggers substitution
export class StepperVariableDeclaration implements VariableDeclaration, StepperBaseNode {
  type: 'VariableDeclaration'
  declarations: StepperVariableDeclarator[]
  kind: 'var' | 'let' | 'const'

  constructor(declarations: StepperVariableDeclarator[], kind: 'var' | 'let' | 'const') {
    this.type = 'VariableDeclaration'
    this.declarations = declarations
    this.kind = kind
  }

  static create(node: VariableDeclaration) {
    return new StepperVariableDeclaration(
      node.declarations.map(node => convert(node) as StepperVariableDeclarator),
      node.kind
    )
  }

  isContractible(): boolean {
    return true // variable declarations always open for contraction
  }

  isOneStepPossible(): boolean {
    return true
  }

  contract(): StepperVariableDeclaration | typeof undefinedNode {
    // Find the one that is not contractible.
    for (let i = 0; i < this.declarations.length; i++) {
      const ast = this.declarations[i]
      if (ast.isContractible()) {
        return new StepperVariableDeclaration(
          [
            this.declarations.slice(0, i),
            ast.contract() as StepperVariableDeclarator,
            this.declarations.slice(i + 1)
          ].flat(),
          this.kind
        )
      }
    }
    redex.preRedex = [this]
    redex.postRedex = []
    // If everything is compatible, trigger substitution on Substitution.Scope
    this.declarations.forEach(declarator => {
      if (declarator.init?.type === 'ArrowFunctionExpression') {
        declarator.init.setGivenName(declarator.id.name)
        console.log(declarator.id.name)
      }
      SubstitutionScope.substitute(declarator.id, declarator.init)
    })
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
          this.kind
        )
      }
    }

    return this.contract()
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperVariableDeclaration(
      this.declarations.map(
        declaration => declaration.substitute(id, value) as StepperVariableDeclarator
      ),
      this.kind
    )
  }

  freeNames(): string[] {
    return Array.from(new Set(this.declarations.flatMap((ast) => ast.freeNames())));
  }

  rename(before: string, after: string): StepperVariableDeclaration {
    return new StepperVariableDeclaration(
      this.declarations.map(
        declaration => declaration.rename(before, after) as StepperVariableDeclarator
      ),
      this.kind
    )
  }
}
