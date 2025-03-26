import { SimpleCallExpression, Comment, SourceLocation } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperExpression, StepperPattern } from '..'
import { convert } from '../../generator'
import { StepperBlockExpression } from './BlockExpression'
import { StepperBlockStatement } from '../Statement/BlockStatement'
import { builtinFunctions } from '../../builtin'

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
    const isValidCallee = 
      this.callee.type === 'ArrowFunctionExpression' || 
      (this.callee.type === 'Identifier' && Object.keys(builtinFunctions).includes(this.callee.name));
    
    if (!isValidCallee) {
      return false;
    }
    
    return this.arguments.every(arg => !arg.isOneStepPossible());
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
      const functionName = this.callee.name;
      if (Object.keys(builtinFunctions).includes(functionName)) {
        const result = builtinFunctions[functionName as keyof typeof builtinFunctions](this.arguments);
        redex.postRedex = [result];
        return result;
      }
      throw new Error(`Unknown builtin function: ${functionName}`);
    }
    
    if (this.callee.type !== 'ArrowFunctionExpression') throw new Error()

    const lambda = this.callee
    const args = this.arguments

    let result: StepperBlockExpression | StepperExpression = lambda.body;
    
    if (result instanceof StepperBlockStatement) {
      const blockStatement = lambda.body as unknown as StepperBlockStatement;
      result = new StepperBlockExpression(
        blockStatement.body
      );
    } else {
      result = lambda.body as StepperExpression;
    }
    
    if (lambda.name && !(this.callee.scanAllDeclarationNames().includes(lambda.name))) {
      result = result.substitute({ type: 'Identifier', name: lambda.name } as StepperPattern, lambda)
    }
    
    lambda.params.forEach((param, i) => {
      result = result.substitute(param as StepperPattern, args[i])
    })

    redex.postRedex = [result]
    return result
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      // @ts-ignore: contract can return StepperBlockExpression but it's handled at runtime
      return this.contract();
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
