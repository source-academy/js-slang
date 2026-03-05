import type { ArrowFunctionExpression, Comment, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { getFreshName } from '../../utils'
import type { StepperBlockStatement } from '../Statement/BlockStatement'

export class StepperArrowFunctionExpression
  extends StepperBaseNode<ArrowFunctionExpression>
  implements ArrowFunctionExpression
{
  constructor(
    public readonly params: StepperPattern[],
    public readonly body: StepperExpression,
    public readonly name?: string,
    public readonly expression: boolean = true,
    public readonly generator: boolean = false,
    public readonly async: boolean = false,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    super('ArrowFunctionExpression', leadingComments, trailingComments, loc, range)
  }

  static create(node: ArrowFunctionExpression) {
    return new StepperArrowFunctionExpression(
      node.params.map(param => convert(param) as StepperPattern),
      convert(node.body) as StepperExpression,
      undefined,
      node.expression,
      node.generator,
      node.async,
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
    return false
  }

  public override contract(): StepperExpression {
    throw new Error('Cannot contract an arrow function expression')
  }

  public override oneStep(): StepperExpression {
    throw new Error('Cannot step an arrow function expression')
  }

  assignName(name: string): StepperArrowFunctionExpression {
    return new StepperArrowFunctionExpression(
      this.params,
      this.body,
      name,
      this.expression,
      this.generator,
      this.async,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  scanAllDeclarationNames(): string[] {
    const paramNames = this.params.map(param => param.name)

    let bodyDeclarations: string[] = []
    // @ts-expect-error gracefully handle block statement as block expression
    if (this.body.type === 'BlockStatement') {
      const body = this.body as StepperBlockStatement
      bodyDeclarations = body.body
        .filter(stmt => stmt.type === 'VariableDeclaration')
        .flatMap(decl => (decl as any).declarations.map((d: any) => d.id.name))
    }

    return [...paramNames, ...bodyDeclarations]
  }

  // TODO: Fix name handling for lambda
  public override substitute(
    id: StepperPattern,
    value: StepperExpression,
    upperBoundName?: string[]
  ): StepperExpression {
    const valueFreeNames = value.freeNames()
    const scopeNames = this.scanAllDeclarationNames()
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))

    let protectedNamesSet = new Set([this.allNames(), upperBoundName ?? []].flat())
    repeatedNames.forEach(name => protectedNamesSet.delete(name))
    const protectedNames = Array.from(protectedNamesSet)
    const newNames = getFreshName(repeatedNames, protectedNames)
    const currentArrowFunction = newNames.reduce(
      (current: StepperArrowFunctionExpression, name: string, index: number) =>
        current.rename(repeatedNames[index], name) as StepperArrowFunctionExpression,
      this
    )
    if (currentArrowFunction.scanAllDeclarationNames().includes(id.name)) {
      return currentArrowFunction
    }

    return new StepperArrowFunctionExpression(
      currentArrowFunction.params,
      currentArrowFunction.body.substitute(
        id,
        value,
        currentArrowFunction.params.flatMap(p => p.allNames())
      ),
      currentArrowFunction.name,
      currentArrowFunction.expression,
      currentArrowFunction.generator,
      currentArrowFunction.async,
      currentArrowFunction.leadingComments,
      currentArrowFunction.trailingComments,
      currentArrowFunction.loc,
      currentArrowFunction.range
    )
  }

  public override freeNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return this.body.freeNames().filter(name => !paramNames.includes(name))
  }

  public override allNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return Array.from(new Set([paramNames, this.body.allNames()].flat()))
  }

  public override rename(before: string, after: string): StepperExpression {
    return new StepperArrowFunctionExpression(
      this.params.map(param => param.rename(before, after)),
      this.body.rename(before, after),
      this.name,
      this.expression,
      this.generator,
      this.async,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
