import { ArrowFunctionExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { getFreshName } from '../../utils'
import { StepperBlockStatement } from '../Statement/BlockStatement'

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
    name?: string,
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
    this.name = name
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
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

  assignName(name: string): StepperArrowFunctionExpression {
    return new StepperArrowFunctionExpression(this.params, 
      this.body, 
      name, 
      this.expression, 
      this.generator, 
      this.async, 
      this.leadingComments, 
      this.trailingComments, 
      this.loc, 
      this.range)
  }

  scanAllDeclarationNames(): string[] {
    const paramNames = this.params.map(param => param.name);
    
    let bodyDeclarations: string[] = [];
    // @ts-ignore
    if (this.body.type === 'BlockStatement') {
      
      const body = this.body as StepperBlockStatement
      bodyDeclarations = body.body
        .filter(stmt => stmt.type === 'VariableDeclaration')
        .flatMap(decl => (decl as any).declarations.map((d: any) => d.id.name));
    }
    
    return [...paramNames, ...bodyDeclarations];
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
        currentArrowFunction.body.substitute(id, value),
        currentArrowFunction.name
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
      this.name,
      this.expression,
      this.generator,
      this.async
    )
  }
}
