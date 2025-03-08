import { SimpleLiteral } from 'estree'
import { StepperExpression } from './nodes/Expression'
import { StepperProgram } from './nodes/Program'
import { StepperExpressionStatement } from './nodes/StepperExpressionStatement'

export interface StepperBaseNode {
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): SimpleLiteral & StepperBaseNode
  oneStep(): StepperExpression | StepperProgram | StepperExpressionStatement
}
