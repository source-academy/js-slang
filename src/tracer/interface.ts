import type { StepperExpression, StepperPattern } from './nodes'

export interface StepperBaseNode {
  type: string
  isContractible(): boolean
  isOneStepPossible(): boolean
  contract(): StepperBaseNode
  oneStep(): StepperBaseNode
  substitute(id: StepperPattern, value: StepperExpression): StepperBaseNode
  freeNames(): string[]
  allNames(): string[]
  rename(before: string, after: string): StepperBaseNode
}
