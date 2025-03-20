import { ArrowFunctionExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { getFreshName } from '../../utils'

export class StepperArrowFunctionExpression implements ArrowFunctionExpression, StepperBaseNode {
  type: 'ArrowFunctionExpression'
  params: StepperPattern[]
  body: StepperExpression
  expression: boolean
  generator: boolean
  async: boolean
  name?: string
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    params: StepperPattern[],
    body: StepperExpression,
    expression: boolean = true,
    generator: boolean = false,
    async: boolean = false,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number],
  ) {
    this.type = 'ArrowFunctionExpression'
    this.params = params
    this.body = body
    this.expression = expression
    this.generator = generator
    this.async = async
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: ArrowFunctionExpression) {
    return new StepperArrowFunctionExpression(
      node.params.map(param => convert(param) as StepperPattern),
      convert(node.body) as StepperExpression,
      node.expression,
      node.generator,
      node.async,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    return false
  }

  isOneStepPossible(): boolean {
    return false
  }

  contract(): StepperExpression {
    throw new Error("Cannot contract an arrow function expression")
  }

  oneStep(): StepperExpression {
    throw new Error("Cannot step an arrow function expression")
  }

  setGivenName(name: string) {
    this.name = name
  }

  scanAllDeclarationNames(): string[] {
    return this.params.map(param => param.name)
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    const valueFreeNames = value.freeNames()
    const scopeNames = this.scanAllDeclarationNames()
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))

    var currentArrowFunction: StepperArrowFunctionExpression = this;
    for (var index in repeatedNames) {
      const name = repeatedNames[index]
      currentArrowFunction = currentArrowFunction.rename(name, getFreshName(name)) as StepperArrowFunctionExpression
    }

    if (currentArrowFunction.scanAllDeclarationNames().includes(id.name)) {
      return currentArrowFunction;
    }

    return new StepperArrowFunctionExpression(
        currentArrowFunction.params,
        currentArrowFunction.body.substitute(id, value)
    )
  }

  freeNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return this.body.freeNames().filter(name => !paramNames.includes(name))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperArrowFunctionExpression(
      this.params.map(param => param.rename(before, after)),
      this.body.rename(before, after),
      this.expression,
      this.generator,
      this.async
    )
  }
}
