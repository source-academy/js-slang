import { Context } from './types'

const LAZY_SOURCE_1 = 2001
const LAZY_SOURCE_2 = 2002

/**
 * Checks whether the interpreter should evaluate
 * the expression lazily in this context. Currently,
 * lazy evaluation is only implemented for Source
 * chapters 1 and 2.
 *
 * @param context The context to be checked.
 * @returns True, if the interpreter is to evaluate
 *     lazily. False, if the interpreter should
 *     evaluate eagerly.
 */
export default function lazyEvaluate(context: Context): boolean {
  return lazyEvaluateInChapter(context.chapter)
}

/**
 * Checks if in the current context, the program will be
 * transpiled with the lazy evaluation transpiler.
 * @param context The context to be checked.
 */
export function lazyEvaluateInTranspiler(context: Context): boolean {
  return (
    lazyEvaluate(context) &&
    (context.executionMethod === 'native' || context.executionMethod === 'auto')
  )
}

/**
 * Checks if in the current context, the program will be
 * interpreted with the lazy evaluation interpreter.
 * @param context The context to be checked.
 */
export function lazyEvaluateInInterpreter(context: Context): boolean {
  return lazyEvaluate(context) && context.executionMethod === 'interpreter'
}

/**
 * Checks whether the interpreter should evaluate the
 * expression lazily, given a chapter number.
 *
 * @param chapter The chapter to be checked.
 * @returns True, if the interpreter is to evaluate
 *     lazily. False, if the interpreter should
 *     evaluate eagerly.
 */
export function lazyEvaluateInChapter(chapter: number): boolean {
  return chapter === LAZY_SOURCE_1 || chapter === LAZY_SOURCE_2
}
