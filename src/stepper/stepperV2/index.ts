import { StepperExpression } from './nodes/Expression'

export let redex: { preRedex: StepperExpression | null; postRedex: StepperExpression | null } = {
  preRedex: null,
  postRedex: null
}
