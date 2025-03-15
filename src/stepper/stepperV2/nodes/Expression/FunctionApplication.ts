import { SimpleCallExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'

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
    range?: [number, number],
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
    if (this.callee.type !== 'ArrowFunctionExpression') return false
    return this.arguments.every(arg => arg.type === 'Literal')
  }

  isOneStepPossible(): boolean {
    if (this.isContractible()) return true
    if (this.callee.isOneStepPossible()) return true
    return this.arguments.some(arg => arg.isOneStepPossible())
  }

  contract(): StepperExpression {
    redex.preRedex = [this]
    if (!this.isContractible()) throw new Error()
    if (this.callee.type !== 'ArrowFunctionExpression') throw new Error()

    const lambda = this.callee
    const args = this.arguments
    
    let result = lambda.body
    lambda.params.forEach((param, i) => {
      result = result.substitute(param as StepperPattern, args[i])
    })

    redex.postRedex = [result]
    return result
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }
    
    if (this.callee.isOneStepPossible()) {
      return new StepperFunctionApplication(
        this.callee.oneStep(),
        this.arguments
      )
    }

    for (let i = 0; i < this.arguments.length; i++) {
      if (this.arguments[i].isOneStepPossible()) {
        const newArgs = [...this.arguments]
        newArgs[i] = this.arguments[i].oneStep()
        return new StepperFunctionApplication(this.callee, newArgs)
      }
    }

    throw new Error("No one step possible")
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    return new StepperFunctionApplication(
      this.callee.substitute(id, value),
      this.arguments.map(arg => arg.substitute(id, value))
    )
  }

  freeNames(): string[] {
    return Array.from(new Set([
      ...this.callee.freeNames(),
      ...this.arguments.flatMap(arg => arg.freeNames())
    ]))
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperFunctionApplication(
      this.callee.rename(before, after),
      this.arguments.map(arg => arg.rename(before, after))
    )
  }
}
