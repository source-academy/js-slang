import { Marker, redex } from '.'
import { IStepperPropContents } from '.'
import { StepperBaseNode } from './interface'

export function getSteps(node: StepperBaseNode): IStepperPropContents[] {
  const steps: IStepperPropContents[] = []
  function evaluate(node: StepperBaseNode): StepperBaseNode {
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep()
      if (redex) {
        const markers: Marker = {
          redex: redex.preRedex,
          redexType: 'beforeMarker'
        }
        steps.push({
          ast: oldNode,
          markers: [markers]
        })
      }
      if (redex) {
        const markers: Marker = {
          redex: redex.postRedex,
          redexType: 'afterMarker'
        }
        steps.push({
          ast: newNode,
          markers: [markers]
        })
      }
      // reset
      redex.preRedex = null;
      redex.postRedex = null;
      return evaluate(newNode)
    } else {
      return node
    }
  }
  // First node
  steps.push({
    ast: node,
    markers: []
  })
  evaluate(node)
  return steps
}
