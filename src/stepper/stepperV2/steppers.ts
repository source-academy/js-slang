import { StepperExpression } from './nodes/Expression'
import { redex } from '.'

export function getSteps(
  node: StepperExpression
): [StepperExpression, StepperExpression | null, string][] {
  const steps: [StepperExpression, StepperExpression | null, string][] = []
  function evaluate(node: StepperExpression): StepperExpression {
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep()
      steps.push([oldNode, redex ? redex.preRedex : null, redex.preRedex ? 'before' : ''])
      steps.push([newNode, redex ? redex.postRedex : null, redex.postRedex ? 'after' : ''])
      return evaluate(newNode)
    } else {
      return node
    }
  }

  steps.push([evaluate(node), null, ''])
  return steps
}
