import * as es from 'estree'
import { Marker, redex } from '.'
import { IStepperPropContents } from '.'
import { StepperBaseNode } from './interface'
import { convert } from './generator'

export function getSteps(inputNode: es.BaseNode): IStepperPropContents[] {
  const node: StepperBaseNode = convert(inputNode);
  const steps: IStepperPropContents[] = []
  function evaluate(node: StepperBaseNode): StepperBaseNode {
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep()
      if (redex) {
        const beforeMarkers: Marker[] = redex.preRedex.map((redex) => ({
          redex: redex,
          redexType: 'beforeMarker'
        }));
        steps.push({
          ast: oldNode,
          markers: beforeMarkers
        })
        const afterMarkers: Marker[] = redex.postRedex.map((redex) => ({
          redex: redex,
          redexType: 'afterMarker'
        }));
        steps.push({
          ast: newNode,
          markers: afterMarkers
        })
      }
      // reset
      redex.preRedex = [];
      redex.postRedex = [];
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
