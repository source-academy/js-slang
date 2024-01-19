import { generate } from "astring";
import { RawSourceMap, SourceMapGenerator } from "source-map";

import { JSSLANG_PROPERTIES, NATIVE_STORAGE_ID } from "../constants";
import { ExceptionError } from "../errors/errors";
import { RuntimeSourceError } from "../errors/runtimeSourceError";
import { TimeoutError } from "../errors/timeoutErrors";
import { isPotentialInfiniteLoop } from "../infiniteLoops/errors";
import { infiniteLoopRunner } from "../infiniteLoops/runtime";
import { resolvedErrorPromise } from "../runner";
import { toSourceError } from "../runner/errors";
import { NativeStorage, Variant } from "../types";
import { forceIt } from "../utils/operators";
import { Runner } from ".";

type Evaler = (code: string, nativeStorage: NativeStorage) => any

const evaler = new Function(
  'code',
  NATIVE_STORAGE_ID,
  `
    if (${NATIVE_STORAGE_ID}.evaller !== null) {
      return ${NATIVE_STORAGE_ID}.evaller(code)
    }
    return eval(code)
  `
) as Evaler

export const fullJSRunner: Runner = async (program, context) => {
  let sourceMapJson: RawSourceMap | undefined
  try {
    const mapGenerator = new SourceMapGenerator({ file: 'source' })
    const transpiled = generate(program, { sourceMap: mapGenerator })
    return {
      status: 'finished',
      context,
      value: evaler(transpiled, context.nativeStorage)
    }
  } catch (error) {
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson)
    )
    return resolvedErrorPromise
  }
}

export const nativeSourceRunner: Runner = async (program, context, options) => {
  if (!options.isPrelude) {
    if (context.shouldIncreaseEvaluationTimeout && context.isPreviousCodeTimeoutError) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      context.nativeStorage.maxExecTime = options.originalMaxExecTime
    }
  }

  let sourceMapJson: RawSourceMap | undefined
  try {
    // switch (context.variant) {
    //   case Variant.GPU:
    //     transpileToGPU(transpiledProgram)
    //     break
    //   case Variant.LAZY:
    //     transpileToLazy(transpiledProgram)
    //     break
    // }
    const mapGenerator = new SourceMapGenerator({ file: 'source' })
    const transpiled = generate(program, { sourceMap: mapGenerator })
    let value = evaler(transpiled, context.nativeStorage)

    if (context.variant === Variant.LAZY) {
      value = forceIt(value)
    }

    if (!options.isPrelude) {
      context.isPreviousCodeTimeoutError = false
    }

    return {
      status: 'finished',
      context,
      value
    }
  } catch (error) {
    const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
    if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
      const detectedInfiniteLoop = await infiniteLoopRunner(
        program,
        context,
        options
        // context.previousPrograms.slice(1)
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
        context.isPreviousCodeTimeoutError = true
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