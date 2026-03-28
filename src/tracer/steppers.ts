import type es from 'estree'
import type { Context, IOptions } from '..'
import { UndefinedVariable } from '../errors/errors'
import { checkProgramForUndefinedVariables } from '../validator/validator'
import { prelude } from './builtins'
import { explain } from './generator'
import type { StepperBaseNode } from './interface'
import { undefinedNode } from './nodes'
import type { StepperProgram } from './nodes/Program'
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement'
import { type IStepperPropContents, type Marker, redex } from '.'

export function getSteps(
  inputNode: es.BaseNode,
  context: Context,
  { stepLimit }: Pick<IOptions, 'stepLimit'>
): IStepperPropContents[] {
  const node: StepperBaseNode = prelude(inputNode)
  const steps: IStepperPropContents[] = []
  const limit = stepLimit === undefined ? 1000 : stepLimit % 2 === 0 ? stepLimit : stepLimit + 1
  let hasError = false

  let numSteps = 1
  function evaluate(node: StepperBaseNode): StepperBaseNode {
    try {
      const isOneStepPossible = node.isOneStepPossible()
      if (isOneStepPossible) {
        const oldNode = node
        let newNode: StepperBaseNode
        newNode = node.oneStep()

        if (redex) {
          const explanations: string[] = redex.preRedex.map(explain)
          const beforeMarkers: Marker[] = redex.preRedex.map((redex, index) => ({
            redex,
            redexType: 'beforeMarker',
            explanation: explanations[index]
          }))
          numSteps += 1
          if (numSteps >= limit) {
            return node
          }
          steps.push({
            ast: oldNode,
            markers: beforeMarkers
          })
          const afterMarkers: Marker[] =
            redex.postRedex.length > 0
              ? redex.postRedex.map((redex, index) => ({
                  redex,
                  redexType: 'afterMarker',
                  explanation: explanations[index]
                }))
              : [
                  {
                    redexType: 'afterMarker',
                    explanation: explanations[0] // use explanation based on preRedex
                  }
                ]
          numSteps += 1
          if (numSteps >= limit) {
            return node
          }
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
    } catch (error) {
      // Handle error during step evaluation
      hasError = true
      steps.push({
        ast: node,
        markers: [
          {
            redexType: 'beforeMarker',
            explanation: error instanceof Error ? error.message : String(error)
          }
        ]
      })
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
  // check for undefined variables
  try {
    checkProgramForUndefinedVariables(inputNode as es.Program, context)
  } catch (error) {
    steps.push({
      ast: node,
      markers: [
        {
          redexType: 'beforeMarker',
          explanation:
            error instanceof UndefinedVariable
              ? `Line ${error.location.start.line}: Name ${error.name} not declared.`
              : String(error)
        }
      ]
    })
    return steps
  }

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
    return steps
  }
  // If the program does not return anything, return undefined
  if (result.type === 'Program' && (result as StepperProgram).body.length === 0) {
    result = new StepperExpressionStatement(undefinedNode)
  }

  if (!hasError) {
    steps.push({
      ast: result,
      markers: [
        {
          explanation: 'Evaluation complete'
        }
      ]
    })
  } else {
    steps.push({
      ast: result,
      markers: [
        {
          explanation: 'Evaluation stuck'
        }
      ]
    })
  }
  return steps
}
