import { Comment, SourceLocation, ReturnStatement } from 'estree'
import { StepperBaseNode } from '../../interface'
import { convert } from '../../generator'
import { StepperExpression, StepperPattern } from '..'
import { redex } from '../..'
import { StepperLiteral } from '../Expression/Literal'

export class StepperReturnStatement implements ReturnStatement, StepperBaseNode {
  type: 'ReturnStatement'
  argument: StepperExpression | null
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined
  
  isContractible(): boolean {
    if (!this.argument) return true;
    return this.argument.type === 'Literal';
  }
  
  isOneStepPossible(): boolean {
    return this.argument ? this.argument.isOneStepPossible() : false
  }
  
  contract(): StepperLiteral {
    if (!this.argument) {
      throw new Error('Cannot contract return statement without argument')
    }
    return this.argument.oneStep() as StepperLiteral;
  }

  contractEmpty() { 
    redex.preRedex = [this]
    redex.postRedex = []
  }
  
  oneStep(): StepperReturnStatement {
    if (!this.argument) {
      throw new Error('Cannot step return statement without argument')
    }
    return new StepperReturnStatement(this.argument.oneStep())
  }

  

  static create(node: ReturnStatement) {
    return new StepperReturnStatement(
      node.argument ? convert(node.argument) as StepperExpression : null,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  constructor(
    argument: StepperExpression | null,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined,
  ) {
    this.type = 'ReturnStatement'
    this.argument = argument;
    this.leadingComments = leadingComments;
    this.trailingComments = trailingComments;
    this.loc = loc;
    this.range = range;
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode {
    return new StepperReturnStatement(
      this.argument ? this.argument.substitute(id, value) as StepperExpression : null
    )
  }

  freeNames(): string[] {
    return this.argument ? this.argument.freeNames() : [];
  }

  rename(before: string, after: string): StepperReturnStatement {
    return new StepperReturnStatement(
      this.argument ? this.argument.rename(before, after) as StepperExpression : null
    )
  }
}
