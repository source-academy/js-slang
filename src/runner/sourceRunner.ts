import * as _ from 'lodash'
import type { RawSourceMap } from 'source-map'

import { JSSLANG_PROPERTIES } from '../constants'
import { CSEResultPromise, evaluate as CSEvaluate } from '../cse-machine/interpreter'
import { ExceptionError } from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import { sandboxedEval } from '../transpiler/evalContainer'
import { transpile } from '../transpiler/transpiler'
import { getSteps } from '../tracer/steppers'
import { Variant } from '../langs'
import { toSourceError } from './errors'
import { resolvedErrorPromise } from './utils'
import type { Runner } from './types'
import fullJSRunner from './fullJSRunner'

let isPreviousCodeTimeoutError = false
const runners = {
  fulljs: fullJSRunner,
  'cse-machine': (program, context, options) => {
    const value = CSEvaluate(program, context, options)
    return CSEResultPromise(context, value)
  },
  substitution: (program, context, options) => {
    const steps = getSteps(program, context, options)
    if (context.errors.length > 0) {
      return resolvedErrorPromise
    }
    return Promise.resolve({
      status: 'finished',
      context,
      value: steps
    })
  },
  native: async (program, context, options) => {
    if (!options.isPrelude) {
      if (context.shouldIncreaseEvaluationTimeout && isPreviousCodeTimeoutError) {
        context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
      } else {
        context.nativeStorage.maxExecTime = options.originalMaxExecTime
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
      const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
      if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
        const detectedInfiniteLoop = testForInfiniteLoop(
          program,
          context.previousPrograms.slice(1),
          context.nativeStorage.loadedModules
        )
        if (detectedInfiniteLoop !== undefined) {
          if (options.throwInfiniteLoops) {
            context.errors.push(detectedInfiniteLoop)
            return resolvedErrorPromise
          } else {
            error.infiniteLoopError = detectedInfiniteLoop
            if (error instanceof ExceptionError) {
              ;(error.error as any).infiniteLoopError = detectedInfiniteLoop
            }
          }
        }
      }
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
} satisfies Record<string, Runner>

export default runners

export type RunnerTypes = keyof typeof runners
