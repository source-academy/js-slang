import { SimpleLiteral } from 'estree'
import { StepperExpression } from './nodes/Expression'

export interface StepperBaseNode {
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): SimpleLiteral & StepperBaseNode
  oneStep(): StepperExpression
}
