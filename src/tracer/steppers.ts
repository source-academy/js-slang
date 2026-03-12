import type es from 'estree'
import { parseError, type Context, type IOptions } from '..'
import { UndefinedVariableError } from '../errors/errors'
import { checkProgramForUndefinedVariables } from '../validator/validator'
import { RuntimeSourceError } from '../errors/base'
import type { StepperProgram } from './nodes/Program'
import { prelude } from './builtins'
import { explain } from './generator'
import type { StepperBaseNode } from './interface'
import { undefinedNode } from './nodes'
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
      if (!(error instanceof RuntimeSourceError)) {
        throw error
      }

      const errStr = parseError([error])

      // Handle error during step evaluation
      hasError = true
      steps.push({
        ast: node,
        markers: [
          {
            redexType: 'beforeMarker',
            explanation: errStr
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
            error instanceof UndefinedVariableError
              ? `Line ${error.location.start.line}: Name ${error.varname} not declared.`
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
