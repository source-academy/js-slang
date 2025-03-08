import { Comment, Program, SimpleLiteral, SourceLocation, VariableDeclaration } from 'estree'
import { StepperBaseNode } from '../interface'
import { StepperExpression } from './Expression'
import { StepperExpressionStatement } from './StepperExpressionStatement'

export class StepperProgram implements Program, StepperBaseNode {
  isContractible(): boolean {
    return this.body[0].type === 'VariableDeclaration' || this.body[0].isContractible()
  }
  isOneStepPossible(): boolean {
    return this.isContractible()
  }
  contract(): SimpleLiteral & StepperBaseNode {
    throw new Error('Method not implemented.')
  }
  oneStep(): StepperExpression {
    throw new Error('Method not implemented.')
  }
  type: 'Program'
  sourceType: 'script' | 'module'
  body: (StepperExpressionStatement | VariableDeclaration)[]
  comments?: Comment[] | undefined
  leadingComments?: Comment[] | undefined
  trailingComments?: Comment[] | undefined
  loc?: SourceLocation | null | undefined
  range?: [number, number] | undefined
}
