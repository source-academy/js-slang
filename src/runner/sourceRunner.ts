import * as _ from 'lodash'
import type { RawSourceMap } from 'source-map'

import { JSSLANG_PROPERTIES } from '../constants'
import { evaluate as CSEvaluate } from '../cse-machine/interpreter'
import { RuntimeSourceError } from '../errors/errorBase'
import { ExceptionError } from '../errors/errors'
import { TimeoutError } from '../errors/timeoutErrors'
import { stepperRunner } from '../tracer/steppers'
import { sandboxedEval } from '../transpiler/evalContainer'
import { transpile } from '../transpiler/transpiler'
import { toSourceError } from './errors'
import fullJSRunner from './fullJSRunner'
import type { BaseRunnerOptions, Runner, UnknownRunner } from './types'
import { resolvedErrorPromise } from './utils'

interface NativeRunnerOptions extends BaseRunnerOptions {
  originalMaxExecTime: number
}

const nativeRunner: Runner<NativeRunnerOptions> = async (program, context, options) => {
  if (!options.isPrelude) {
    if (context.shouldIncreaseEvaluationTimeout && isPreviousCodeTimeoutError) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      context.nativeStorage.maxExecTime = options.originalMaxExecTime ?? 1000
    }
  }

  // For whatever reason, the transpiler mutates the state of the AST as it is transpiling and inserts
  // a bunch of global identifiers to it. Once that happens, the infinite loop detection instrumentation
  // ends up generating code that has syntax errors. As such, we need to make a deep copy here to preserve
  // the original AST for future use, such as with the infinite loop detector.
  const transpiledProgram = _.cloneDeep(program)
  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    ;({ transpiled, sourceMapJson } = transpile(transpiledProgram, context))
    let value = sandboxedEval(transpiled, context.nativeStorage)

    if (!options.isPrelude) {
      isPreviousCodeTimeoutError = false
    }

    return {
      status: 'finished',
      context,
      value
    }
  } catch (error) {
    if (error instanceof RuntimeSourceError) {
      context.errors.push(error)
      if (error instanceof TimeoutError) {
        isPreviousCodeTimeoutError = true
      }
      return resolvedErrorPromise
    }
    if (error instanceof ExceptionError) {
      // if we know the location of the error, just throw it
      if (error.location.start.line !== -1) {
        context.errors.push(error)
        return resolvedErrorPromise
      } else {
        error = error.error // else we try to get the location from source map
      }
    }

    const sourceError = await toSourceError(error, sourceMapJson)
    context.errors.push(sourceError)
    return resolvedErrorPromise
  }
}

let isPreviousCodeTimeoutError = false
const runners = {
  fulljs: fullJSRunner,
  'cse-machine': CSEvaluate,
  substitution: stepperRunner,
  native: nativeRunner
} satisfies Record<string, Runner<any>>

export default runners

/**
 * Names of the available runners
 */
export type RunnerTypes = keyof typeof runners

/**
 * Represents the options required by different runners
 */
export type RunnerOptions =
  | {
      [K in RunnerTypes]: (typeof runners)[K] extends Runner<infer U>
        ? U & { executionMethod: K }
        : never
    }[RunnerTypes]
  | UnknownRunner

/**
 * Names of the available runners, including the `auto` option.
 * The `undefined` value is equivalent to the `auto` option
 * @see RunnerTypes
 */
export type ExecutionMethod = RunnerOptions['executionMethod']
