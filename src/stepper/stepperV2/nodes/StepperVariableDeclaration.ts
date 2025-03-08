import { VariableDeclaration, VariableDeclarator, Pattern } from 'estree'
import { StepperBaseNode } from '../interface'
import { convert } from '../generator'
import { StepperExpression, undefinedNode } from '.'
import { redex } from '..'

export class StepperVariableDeclarator implements VariableDeclarator, StepperBaseNode {
  type: 'VariableDeclarator'
  id: Pattern // use estree for convenient
  init?: StepperExpression | null | undefined

  constructor(id: Pattern, init: StepperExpression | null | undefined) {
    this.type = 'VariableDeclarator';
    this.id = id;
    this.init = init
  }

  static create(node: VariableDeclarator) {
    return new StepperVariableDeclarator(
      node.id,
      node.init ? convert(node.init) as StepperExpression : node.init
    );
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
}

// After all variable declarators have been contracted,
// StepperVariableDeclaration::contract triggers substitution
export class StepperVariableDeclaration implements VariableDeclaration, StepperBaseNode {
  type: 'VariableDeclaration'
  declarations: StepperVariableDeclarator[]
  kind: 'var' | 'let' | 'const'

  constructor(declarations: StepperVariableDeclarator[], kind: 'var' | 'let' | 'const') {
    this.type = 'VariableDeclaration';
    this.declarations = declarations;
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
    return this.isContractible()
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
    // If everything is compatible, trigger substitution
    // TODO: add substitution (but where?)
    // console.log("SUBSTITUTE", this.declarations[0])
    this.contractEmpty()
    return undefinedNode;
  }

  contractEmpty() {
    redex.preRedex = this;
    redex.postRedex = null;
  }

  oneStep(): StepperVariableDeclaration | typeof undefinedNode {
    return this.contract()
  }
}
