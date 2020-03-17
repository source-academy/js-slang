import { Context } from './types'

/**
 * Checks whether the interpreter should evaluate
 * the expression lazily in this context. Currently,
 * lazy evaluation is only implemented for Source
 * chapters 1 and 2, so lazyEvaluate will return true
 * only when the chapter is 1 or 2.
 * @param context The context to be checked.
 * @returns True, if the interpreter is to evaluate
 *     lazily. False, if the interpreter should
 *     evaluate eagerly.
 */
export default function lazyEvaluate(context: Context) {
  return lazyEvaluateInChapter(context.chapter)
}

/**
 * Checks whether the interpreter should evaluate the
 * expression lazily, given a chapter number.
 * @param chapter The chapter to be checked.
 * @returns True, if the interpreter is to evaluate
 *     lazily. False, if the interpreter should
 *     evaluate eagerly.
 */
export function lazyEvaluateInChapter(chapter: number) {
  return chapter === -1
}
