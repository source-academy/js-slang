import { StepperExpression } from "./nodes"
import { StepperIdentifier } from "./nodes/Identifier"

export interface StepperBaseNode {
  type: string
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): StepperBaseNode
  oneStep(): StepperBaseNode
  substitute(id: StepperIdentifier, value: StepperExpression): StepperBaseNode
}
