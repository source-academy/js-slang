import { Comment, Program, SourceLocation } from 'estree'
import { StepperBaseNode } from '../interface'
import { convert } from '../generator'
import { StepperStatement } from './StepperStatement'
import { undefinedNode } from '.'

export class StepperProgram implements Program, StepperBaseNode {
  isContractible(): boolean {
    return this.body[0].isContractible() || this.body.length >= 2
  }

  isOneStepPossible(): boolean {
    return this.body.length === 0 || this.isContractible()
  }

  contract(): StepperProgram | typeof undefinedNode {
    if (this.body[0].isContractible()) {
      // E1; E2; -> E1'; E2;
      const firstStatementContracted = this.body[0].contract(); 
      if (firstStatementContracted === undefinedNode) {
        return new StepperProgram(this.body.slice(1));
      } else {
        return new StepperProgram([firstStatementContracted as StepperStatement, this.body.slice(1)].flat());
      }
    }
    if (this.body.length >= 2 && this.body[1].isContractible()) {
      // V; E; -> V; E';
      const secondStatementContract = this.body[1].contract();
      if (secondStatementContract === undefinedNode) {
        return new StepperProgram([this.body[0], this.body.slice(2)].flat());
      } else {
        return new StepperProgram([this.body[0], secondStatementContract as StepperStatement, this.body.slice(2)].flat());
      }
    }
    // V1; V2; -> {}, V2; -> V2;
    this.body[0].contractEmpty() // update the contracted statement onto redex
    return new StepperProgram(this.body.slice(1));
  }

  oneStep(): StepperProgram | typeof undefinedNode {
    if (this.body.length == 0) {
      return undefinedNode;
    }
    return this.contract()
  }

  type: 'Program'
  sourceType: 'script' | 'module'
  body: (StepperStatement)[]
  comments?: Comment[] | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined

  static create(node: Program) {
    return new StepperProgram(
      node.body.map((ast) => convert(ast) as StepperStatement),
      node.comments,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  constructor(
    body: (StepperStatement)[], // TODO: Add support for variable declaration
    comments?: Comment[] | undefined,
    leadingComments?: Comment[] | undefined,
    trailingComments?: Comment[] | undefined,
    loc?: SourceLocation | null | undefined,
    range?: [number, number] | undefined,
  ) {
    this.type = 'Program'
    this.sourceType = 'module';
    this.body = body
    this.comments = comments
    this.leadingComments = leadingComments;
    this.trailingComments = trailingComments;
    this.loc = loc;
    this.range = range;
  }
}
