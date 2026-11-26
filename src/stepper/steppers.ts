import type es from 'estree';
import { parseError, type Context, type IOptions } from '..';
import { UndefinedVariableError } from '../errors/errors';
import { checkProgramForUndefinedVariables } from '../validator/validator';
import { RuntimeSourceError } from '../errors/base';
import type { StepperProgram } from './nodes/Program';
import { prelude } from './builtins';
import { explain } from './generator';
import type { StepperBaseNode } from './interface';
import { undefinedNode } from './nodes';
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement';
import type { IStepperPropContents, Marker, RedexInfo } from '.';

/** How a run of {@link generateSteps} ended, once its last step has been produced. */
export type StepsEnd = {
  /** Whether the run was cut off by the step limit, before the program had finished. */
  readonly limitReached: boolean;
};

/**
 * The steps of the program, one at a time, as they are computed: the first step is there before
 * the program has been stepped at all, so that a caller can pass the steps on while a long run is
 * going (and keep those it had if the run is stopped). The generator returns how the run ended.
 *
 * The steps are those of {@link getSteps}, which collects them.
 */
export function* generateSteps(
  inputNode: es.BaseNode,
  context: Context,
  { stepLimit }: Pick<IOptions, 'stepLimit'>,
): Generator<IStepperPropContents, StepsEnd> {
  const redex: RedexInfo = {
    preRedex: [],
    postRedex: [],
  };

  const node = prelude(inputNode, redex);
  const limit = stepLimit === undefined ? 1000 : stepLimit % 2 === 0 ? stepLimit : stepLimit + 1;
  let hasError = false;

  // First node
  yield {
    ast: node,
    markers: [
      {
        explanation: 'Start of evaluation',
      },
    ],
  };
  // check for undefined variables
  try {
    checkProgramForUndefinedVariables(inputNode as es.Program, context);
  } catch (error) {
    yield {
      ast: node,
      markers: [
        {
          redexType: 'beforeMarker',
          explanation:
            error instanceof UndefinedVariableError
              ? `Line ${error.location.start.line}: Name ${error.varname} not declared.`
              : String(error),
        },
      ],
    };
    return { limitReached: false };
  }

  // A loop and not a recursion, so that the depth of the program's evaluation, which can be
  // thousands of steps, does not grow the call stack.
  let numSteps = 1;
  let current: StepperBaseNode = node;
  for (;;) {
    try {
      if (!current.isOneStepPossible(redex)) break;
      const newNode = current.oneStep(redex);

      const explanations = redex.preRedex.map(explain);
      const beforeMarkers = redex.preRedex.map((redex, index): Marker => ({
        redex,
        redexType: 'beforeMarker',
        explanation: explanations[index],
      }));
      numSteps += 1;
      if (numSteps >= limit) break;
      yield {
        ast: current,
        markers: beforeMarkers,
      };

      const afterMarkers: Marker[] =
        redex.postRedex.length > 0
          ? redex.postRedex.map((redex, index) => ({
              redexType: 'afterMarker',
              explanation: explanations[index],
            }))
          : [
              {
                redexType: 'afterMarker',
                explanation: explanations[0], // use explanation based on preRedex
              },
            ];
      numSteps += 1;
      if (numSteps >= limit) break;
      yield {
        ast: newNode,
        markers: afterMarkers,
      };

      // reset
      redex.preRedex = [];
      redex.postRedex = [];
      current = newNode;
    } catch (error) {
      if (!(error instanceof RuntimeSourceError)) {
        throw error;
      }

      const errStr = parseError([error]);

      // Handle error during step evaluation
      hasError = true;
      yield {
        ast: current,
        markers: [
          {
            redexType: 'beforeMarker',
            explanation: errStr,
          },
        ],
      };
      break;
    }
  }

  let result = current;
  // If program has not completed within the step limit, halt.
  if (numSteps >= limit) {
    yield {
      ast: result,
      markers: [
        {
          explanation: 'Maximum number of steps exceeded',
        },
      ],
    };
    return { limitReached: true };
  }
  // If the program does not return anything, return undefined
  if (result.type === 'Program' && (result as StepperProgram).body.length === 0) {
    result = new StepperExpressionStatement(undefinedNode);
  }

  yield {
    ast: result,
    markers: [
      {
        explanation: hasError ? 'Evaluation stuck' : 'Evaluation complete',
      },
    ],
  };
  return { limitReached: false };
}

export function getSteps(
  inputNode: es.BaseNode,
  context: Context,
  options: Pick<IOptions, 'stepLimit'>,
): IStepperPropContents[] {
  const steps: IStepperPropContents[] = [];
  const generator = generateSteps(inputNode, context, options);
  for (let next = generator.next(); !next.done; next = generator.next()) {
    steps.push(next.value);
  }
  return steps;
}
