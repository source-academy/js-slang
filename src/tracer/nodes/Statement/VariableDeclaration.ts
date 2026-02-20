import type { Comment, SourceLocation, VariableDeclaration, VariableDeclarator } from 'estree'
import { type StepperExpression, type StepperPattern, undefinedNode } from '..'
import { redex } from '../..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'

export class StepperVariableDeclarator
  extends StepperBaseNode<VariableDeclarator>
  implements VariableDeclarator
{
  constructor(
    public readonly id: StepperPattern,
    public readonly init: StepperExpression | null | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('VariableDeclarator', leadingComments, trailingComments, loc, range)
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

  public override isContractible(): boolean {
    return this.init ? this.init.isContractible() : false
  }

  public override isOneStepPossible(): boolean {
    return this.init ? this.init.isOneStepPossible() : false
  }

  public override contract(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(
      this.id,
      this.init!.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override oneStep(): StepperVariableDeclarator {
    return new StepperVariableDeclarator(
      this.id,
      this.init!.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperVariableDeclarator(
      this.id,
      this.init!.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  public override freeNames(): string[] {
    return this.init!.freeNames()
  }

  public override allNames(): string[] {
    return this.init!.allNames()
  }

  rename(before: string, after: string): StepperVariableDeclarator {
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
export class StepperVariableDeclaration
  extends StepperBaseNode<VariableDeclaration>
  implements VariableDeclaration
{
  constructor(
    public readonly declarations: StepperVariableDeclarator[],
    public readonly kind: VariableDeclaration['kind'],
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    super('VariableDeclaration', leadingComments, trailingComments, loc, range)
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

  public override isContractible(): boolean {
    return false
  }

  public override isOneStepPossible(): boolean {
    return this.declarations
      .map(x => x.isOneStepPossible())
      .reduce((acc, next) => acc || next, false)
  }

  public override contract(): typeof undefinedNode {
    redex.preRedex = [this]
    redex.postRedex = []
    return undefinedNode
  }

  contractEmpty() {
    redex.preRedex = [this]
    redex.postRedex = []
  }

  public override oneStep(): StepperVariableDeclaration | typeof undefinedNode {
    // Find the one that is not contractible.
    for (let i = 0; i < this.declarations.length; i++) {
      const ast = this.declarations[i]
      if (ast.isOneStepPossible()) {
        return new StepperVariableDeclaration(
          [this.declarations.slice(0, i), ast.oneStep(), this.declarations.slice(i + 1)].flat(),
          this.kind,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
    }

    return this
  }

  public override substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
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

  public override freeNames(): string[] {
    return Array.from(new Set(this.declarations.flatMap(ast => ast.freeNames())))
  }

  public override allNames(): string[] {
    return Array.from(new Set(this.declarations.flatMap(ast => ast.allNames())))
  }

  rename(before: string, after: string): StepperVariableDeclaration {
    return new StepperVariableDeclaration(
      this.declarations.map(declaration => declaration.rename(before, after)),
      this.kind,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
