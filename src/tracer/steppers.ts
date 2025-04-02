import * as es from 'estree'
import { Marker, redex } from '.'
import { IStepperPropContents } from '.'
import { StepperBaseNode } from './interface'
import { convert, explain } from './generator'
import { StepperProgram } from './nodes/Program'
import { undefinedNode } from './nodes'
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement'
import { prelude } from './builtins'
import { IOptions } from '..'

export function getSteps(
  inputNode: es.BaseNode,
  { stepLimit }: Pick<IOptions, 'stepLimit'>
): IStepperPropContents[] {
  const node: StepperBaseNode = prelude(convert(inputNode))
  const steps: IStepperPropContents[] = []
  const limit = stepLimit === undefined ? 1000 : stepLimit % 2 === 0 ? stepLimit : stepLimit + 1
  let numSteps = 0
  function evaluate(node: StepperBaseNode): StepperBaseNode {
    numSteps += 1
    if (numSteps >= limit) {
      return node;
    }
    const isOneStepPossible = node.isOneStepPossible()
    if (isOneStepPossible) {
      const oldNode = node
      const newNode = node.oneStep()
      if (redex) {
        const explanations: string[] = redex.preRedex.map(explain)
        const beforeMarkers: Marker[] = redex.preRedex.map((redex, index) => ({
          redex: redex,
          redexType: 'beforeMarker',
          explanation: explanations[index]
        }))
        steps.push({
          ast: oldNode,
          markers: beforeMarkers
        })
        const afterMarkers: Marker[] =
          redex.postRedex.length > 0
            ? redex.postRedex.map((redex, index) => ({
                redex: redex,
                redexType: 'afterMarker',
                explanation: explanations[index]
              }))
            : [
                {
                  redexType: 'afterMarker',
                  explanation: explanations[0] // use explanation based on preRedex
                }
              ]
        steps.push({
          ast: newNode,
          markers: afterMarkers
        })
      }
      // reset
      redex.preRedex = []
      redex.postRedex = []
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
        explanation: 'Start of evaluation'
      }
    ]
  })
  let result = evaluate(node)
  // If program has not completed within the step limit, halt.
  if (numSteps >= limit) {
      steps.push({
      ast: result,
      markers: [
        {
          explanation: 'Maximum number of steps exceeded'
        }
      ]
    })
  }
  // If the program does not return anything, return undefined
  if (result.type === 'Program' && (result as StepperProgram).body.length === 0) {
    result = new StepperExpressionStatement(undefinedNode)
  }
  steps.push({
    ast: result,
    markers: [
      {
        explanation: 'Evaluation complete'
      }
    ]
  })
  return steps
}
