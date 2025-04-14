import { Comment, FunctionDeclaration, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { StepperIdentifier } from '../Expression/Identifier'
import { StepperExpression, StepperPattern, undefinedNode } from '..'
import { convert } from '../../generator'
import { redex } from '../..'
import { StepperArrowFunctionExpression } from '../Expression/ArrowFunctionExpression'
import { getFreshName } from '../../utils'
import { StepperBlockStatement } from './BlockStatement'
import { StepperVariableDeclaration } from './VariableDeclaration'

export class StepperFunctionDeclaration implements FunctionDeclaration, StepperBaseNode {
  type: 'FunctionDeclaration'
  id: StepperIdentifier
  body: StepperBlockStatement
  params: StepperPattern[]
  generator?: boolean | undefined
  async?: boolean | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  constructor(
    id: StepperIdentifier,
    body: StepperBlockStatement,
    params: StepperPattern[],
    generator?: boolean | undefined,
    async?: boolean | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined
  ) {
    this.type = 'FunctionDeclaration'
    this.id = id
    this.params = params
    this.generator = generator
    this.async = async
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range

    /*    
    const repeatedNames = body.scanAllDeclarationNames().filter(name => name === this.id.name);
    const newNames = getFreshName([this.id.name], repeatedNames)
    let currentBlockStatement = body
    for (var index in newNames) {
      currentBlockStatement = currentBlockStatement.rename(repeatedNames[index], newNames[index])
    }
  */
    this.body = body
  }
  static create(node: FunctionDeclaration) {
    return new StepperFunctionDeclaration(
      convert(node.id) as StepperIdentifier,
      convert(node.body) as StepperBlockStatement,
      node.params.map(param => convert(param) as StepperPattern),
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

  getArrowFunctionExpression() {
    return new StepperArrowFunctionExpression(
      this.params,
      this.body as unknown as StepperExpression,
      this.id.name, // mu term
      false,
      this.async,
      this.generator
    )
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

  oneStep(): typeof undefinedNode {
    return this.contract()
  }

  scanAllDeclarationNames(): string[] {
    const paramNames = this.params.map(param => param.name)
    const bodyDeclarations = this.body.body
      .filter(ast => ast.type === 'VariableDeclaration' || ast.type === 'FunctionDeclaration')
      .flatMap((ast: StepperVariableDeclaration | StepperFunctionDeclaration) => {
        if (ast.type === 'VariableDeclaration') {
          return ast.declarations.map(ast => ast.id.name)
        } else {
          // Function Declaration
          return [(ast as StepperFunctionDeclaration).id.name]
        }
      })
    return [...paramNames, ...bodyDeclarations]
  }

  substitute(
    id: StepperPattern,
    value: StepperExpression,
    upperBoundName?: string[]
  ): StepperBaseNode {
    const valueFreeNames = value.freeNames()
    const scopeNames = this.scanAllDeclarationNames()
    const repeatedNames = valueFreeNames.filter(name => scopeNames.includes(name))

    let protectedNamesSet = new Set([this.allNames(), upperBoundName ?? []].flat())
    repeatedNames.forEach(name => protectedNamesSet.delete(name))
    const protectedNames = Array.from(protectedNamesSet)
    const newNames = getFreshName(repeatedNames, protectedNames)

    const currentFunction = newNames.reduce(
      (current: StepperFunctionDeclaration, name: string, index: number) => 
        current.rename(
          repeatedNames[index],
          name
        ) as StepperFunctionDeclaration, 
        this
    );

    if (currentFunction.scanAllDeclarationNames().includes(id.name)) {
      return currentFunction
    }

    return new StepperFunctionDeclaration(
      this.id,
      currentFunction.body.substitute(
        id,
        value,
        currentFunction.params.flatMap(p => p.allNames())
      ) as unknown as StepperBlockStatement,
      currentFunction.params,
      this.generator,
      this.async,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return this.body.freeNames().filter(name => !paramNames.includes(name))
  }

  allNames(): string[] {
    const paramNames = this.params
      .filter(param => param.type === 'Identifier')
      .map(param => param.name)
    return Array.from(new Set([paramNames, this.body.allNames()].flat()))
  }

  rename(before: string, after: string): StepperFunctionDeclaration {
    return new StepperFunctionDeclaration(
      this.id.rename(before, after),
      this.body.rename(before, after) as unknown as StepperBlockStatement,
      this.params.map(param => param.rename(before, after)),
      this.generator,
      this.async,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
