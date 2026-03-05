import type { Comment, SimpleCallExpression, SourceLocation } from 'estree'
import type { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { getBuiltinFunction, isBuiltinFunction } from '../../builtins'
import { convert } from '../../generator'
import { StepperBaseNode } from '../../interface'
import { StepperBlockStatement } from '../Statement/BlockStatement'
import { CallingNonFunctionValueError, InvalidNumberOfArgumentsError } from '../../../errors/errors'
import { GeneralRuntimeError } from '../../../errors/base'
import { StepperBlockExpression } from './BlockExpression'

export class StepperFunctionApplication
  extends StepperBaseNode<SimpleCallExpression>
  implements SimpleCallExpression
{
  public readonly arguments: StepperExpression[]

  constructor(
    public readonly callee: StepperExpression,
    args: StepperExpression[],
    public readonly optional: boolean = false,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    super('CallExpression', leadingComments, trailingComments, loc, range)
    this.arguments = args
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

  public override isContractible(): boolean {
    const isValidCallee =
      this.callee.type === 'ArrowFunctionExpression' ||
      (this.callee.type === 'Identifier' && isBuiltinFunction(this.callee.name))

    if (!isValidCallee) {
      // Since the callee can not proceed further, calling non callables should result to an error.
      if (
        !this.callee.isOneStepPossible() &&
        this.arguments.every(arg => !arg.isOneStepPossible())
      ) {
        throw new CallingNonFunctionValueError(this.callee, this)
      }
      return false
    }

    if (this.callee.type === 'ArrowFunctionExpression') {
      const arrowFunction = this.callee
      if (arrowFunction.params.length !== this.arguments.length) {
        throw new InvalidNumberOfArgumentsError(
          this,
          arrowFunction.params.length,
          this.arguments.length
        )
      }
    }

    return this.arguments.every(arg => !arg.isOneStepPossible())
  }

  public override isOneStepPossible(): boolean {
    if (this.isContractible()) return true
    if (this.callee.isOneStepPossible()) return true
    return this.arguments.some(arg => arg.isOneStepPossible())
  }

  public override contract(): StepperExpression | StepperBlockExpression {
    redex.preRedex = [this]
    if (!this.isContractible()) throw new Error()
    if (this.callee.type === 'Identifier') {
      const functionName = this.callee.name
      if (isBuiltinFunction(functionName)) {
        const result = getBuiltinFunction(functionName, this)
        redex.postRedex = [result]
        return result
      }
      throw new GeneralRuntimeError(`Unknown builtin function: ${functionName}`, this)
    }

    if (this.callee.type !== 'ArrowFunctionExpression') {
      throw new CallingNonFunctionValueError(this.callee, this)
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
        result = blockStatement.body[0].argument!
      } else {
        result = new StepperBlockExpression(blockStatement.body)
      }
    } else {
      result = lambda.body
    }
    if (lambda.name && !this.callee.scanAllDeclarationNames().includes(lambda.name)) {
      result = result.substitute(
        { type: 'Identifier', name: lambda.name } as StepperPattern,
        lambda
      )
    }

    lambda.params.forEach((param, i) => {
      result = result.substitute(param, args[i])
    })

    redex.postRedex = [result]
    return result
  }

  public override oneStep(): StepperExpression {
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

  public override substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
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

  public override freeNames(): string[] {
    return Array.from(
      new Set([...this.callee.freeNames(), ...this.arguments.flatMap(arg => arg.freeNames())])
    )
  }

  public override allNames(): string[] {
    return Array.from(
      new Set([...this.callee.allNames(), ...this.arguments.flatMap(arg => arg.allNames())])
    )
  }

  public override rename(before: string, after: string): StepperExpression {
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
