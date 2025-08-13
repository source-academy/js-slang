import * as astring from 'astring'
import type { Comment, SimpleCallExpression, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { getBuiltinFunction, isBuiltinFunction } from '../../builtins'
import { convert } from '../../generator'
import type { StepperBaseNode } from '../../interface'
import { StepperBlockStatement } from '../Statement/BlockStatement'
import { StepperReturnStatement } from '../Statement/ReturnStatement'
import { StepperArrowFunctionExpression } from './ArrowFunctionExpression'
import { StepperBlockExpression } from './BlockExpression'
export class StepperFunctionApplication implements SimpleCallExpression, StepperBaseNode {
  type: 'CallExpression'
  callee: StepperExpression
  arguments: StepperExpression[]
  optional: boolean
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    callee: StepperExpression,
    args: StepperExpression[],
    optional: boolean = false,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'CallExpression'
    this.callee = callee
    this.arguments = args
    this.optional = optional
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static create(node: SimpleCallExpression) {
    return new StepperFunctionApplication(
      convert(node.callee) as StepperExpression,
      node.arguments.map(arg => convert(arg) as StepperExpression),
      node.optional,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    const isValidCallee =
      this.callee.type === 'ArrowFunctionExpression' ||
      (this.callee.type === 'Identifier' && isBuiltinFunction(this.callee.name))

    if (!isValidCallee) {
      // Since the callee can not be proceed further, calling non callables should result to an error.
      if (
        !this.callee.isOneStepPossible() &&
        this.arguments.every(arg => !arg.isOneStepPossible())
      ) {
        throw new Error(
          `Line ${this.loc?.start.line || 0}: Calling non-function value ${astring.generate(
            this.callee
          )}`
        )
      }
      return false
    }

    if (this.callee.type === 'ArrowFunctionExpression') {
      const arrowFunction = this.callee as StepperArrowFunctionExpression
      if (arrowFunction.params.length !== this.arguments.length) {
        throw new Error(
          `Line ${this.loc?.start.line || 0}: Expected ${
            arrowFunction.params.length
          } arguments, but got ${this.arguments.length}.`
        )
      }
    }

    return this.arguments.every(arg => !arg.isOneStepPossible())
  }

  isOneStepPossible(): boolean {
    if (this.isContractible()) return true
    if (this.callee.isOneStepPossible()) return true
    return this.arguments.some(arg => arg.isOneStepPossible())
  }

  contract(): StepperExpression | StepperBlockExpression {
    redex.preRedex = [this]
    if (!this.isContractible()) throw new Error()
    if (this.callee.type === 'Identifier') {
      const functionName = this.callee.name
      if (isBuiltinFunction(functionName)) {
        const result = getBuiltinFunction(functionName, this.arguments)
        redex.postRedex = [result]
        return result
      }
      throw new Error(`Unknown builtin function: ${functionName}`)
    }

    if (this.callee.type !== 'ArrowFunctionExpression') {
      throw new Error()
    }

    const lambda = this.callee
    const args = this.arguments

    let result: StepperBlockExpression | StepperExpression = lambda.body

    if (result instanceof StepperBlockStatement) {
      const blockStatement = lambda.body as unknown as StepperBlockStatement
      if (blockStatement.body.length === 0) {
        result = new StepperBlockExpression([])
      } else if (blockStatement.body[0].type === 'ReturnStatement') {
        // (x => {return 2 + 3;})(3) -> 2 + 3;
        result = (blockStatement.body[0] as StepperReturnStatement).argument!
      } else {
        result = new StepperBlockExpression(blockStatement.body)
      }
    } else {
      result = lambda.body as StepperExpression
    }
    if (lambda.name && !this.callee.scanAllDeclarationNames().includes(lambda.name)) {
      result = result.substitute(
        { type: 'Identifier', name: lambda.name } as StepperPattern,
        lambda
      )
    }

    lambda.params.forEach((param, i) => {
      result = result.substitute(param as StepperPattern, args[i])
    })

    redex.postRedex = [result]
    return result
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      // @ts-expect-error: contract can return StepperBlockExpression but it's handled at runtime
      return this.contract()
    }

    if (this.callee.isOneStepPossible()) {
      return new StepperFunctionApplication(
        this.callee.oneStep(),
        this.arguments,
        this.optional,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
    }

    for (let i = 0; i < this.arguments.length; i++) {
      if (this.arguments[i].isOneStepPossible()) {
        const newArgs = [...this.arguments]
        newArgs[i] = this.arguments[i].oneStep()
        return new StepperFunctionApplication(
          this.callee,
          newArgs,
          this.optional,
          this.leadingComments,
          this.trailingComments,
          this.loc,
          this.range
        )
      }
    }

    throw new Error('No one step possible')
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperFunctionApplication(
      this.callee.substitute(id, value),
      this.arguments.map(arg => arg.substitute(id, value)),
      this.optional,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }

  freeNames(): string[] {
    return Array.from(
      new Set([...this.callee.freeNames(), ...this.arguments.flatMap(arg => arg.freeNames())])
    )
  }

  allNames(): string[] {
    return Array.from(
      new Set([...this.callee.allNames(), ...this.arguments.flatMap(arg => arg.allNames())])
    )
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperFunctionApplication(
      this.callee.rename(before, after),
      this.arguments.map(arg => arg.rename(before, after)),
      this.optional,
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
