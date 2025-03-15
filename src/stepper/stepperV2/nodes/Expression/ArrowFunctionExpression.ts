import { ArrowFunctionExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'

export class StepperArrowFunctionExpression implements ArrowFunctionExpression, StepperBaseNode {
  type: 'ArrowFunctionExpression'
  params: StepperPattern[]
  body: StepperExpression
  expression: boolean
  generator: boolean
  async: boolean
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

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    // Only substitute in body if parameter name doesn't shadow the id
    if (!this.params.some(param => param.type === 'Identifier' && param.name === id.name)) {
      return new StepperArrowFunctionExpression(
        this.params,
        this.body.substitute(id, value),
        this.expression,
        this.generator,
        this.async
      )
    }
    return this
  }

  freeNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return this.body.freeNames().filter(name => !paramNames.includes(name))
  }

  rename(before: string, after: string): StepperExpression {
    if (!this.params.some(param => param.type === 'Identifier' && param.name === before)) {
      return new StepperArrowFunctionExpression(
        this.params,
        this.body.rename(before, after),
        this.expression,
        this.generator,
        this.async
      )
    }
    return this
  }
}
