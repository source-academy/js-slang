import * as es from 'estree'
import { Marker, redex } from '.'
import { IStepperPropContents } from '.'
import { StepperBaseNode } from './interface'
import { convert, explain } from './generator'

export function getSteps(inputNode: es.BaseNode): IStepperPropContents[] {
  const node: StepperBaseNode = convert(inputNode);
  const steps: IStepperPropContents[] = []
  function evaluate(node: StepperBaseNode): StepperBaseNode {
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep()
      if (redex) {
        const explainations: string[] = redex.preRedex.map(explain);
        const beforeMarkers: Marker[] = redex.preRedex.map((redex, index) => ({
          redex: redex,
          redexType: 'beforeMarker',
          explanation: explainations[index]
        }));
        steps.push({
          ast: oldNode,
          markers: beforeMarkers
        })
        const afterMarkers: Marker[] = redex.postRedex.map((redex, index) => ({
          redex: redex,
          redexType: 'afterMarker',
          explanation: explainations[index]
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
    markers: [
      {
        explanation: "Start of evaluation"
      }
    ]
  })
  const result = evaluate(node)
  steps.push({
    ast: result,
    markers: [
      {
        explanation: "Evaluation complete"
      }
    ]
  })
  return steps
}
