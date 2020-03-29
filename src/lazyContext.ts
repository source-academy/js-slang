import { Context } from './types'

export const LAZY_SOURCE_1 = 2001
export const LAZY_SOURCE_2 = 2002

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
 *
 * @param context The context to be checked.
 */
export function lazyEvaluateInTranspiler(context: Context): boolean {
  return lazyEvaluate(context) && context.executionMethod === 'native'
}

/**
 * Checks if in the current context, the program will be
 * interpreted with the lazy evaluation interpreter.
 *
 * @param context The context to be checked.
 */
export function lazyEvaluateInInterpreter(context: Context): boolean {
  return lazyEvaluate(context) && context.executionMethod === 'interpreter'
}

/**
 * Checks if we have to dynamically determine which execution
 * method to use in this context for lazy evaluation.
 *
 * @param context The context to be checked.
 */
export function lazyEvaluateAuto(context: Context): boolean {
  return lazyEvaluate(context) && context.executionMethod === 'auto'
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
  return lazyEvaluateInSource1(chapter) || lazyEvaluateInSource2(chapter)
}

/**
 * Checks whether this chapter number represents
 * Lazy Source chapter 1 (functions, arithmetic,
 * conditionals).
 *
 * @param chapter The chapter number.
 */
export function lazyEvaluateInSource1(chapter: number): boolean {
  return chapter === LAZY_SOURCE_1
}

/**
 * Checks whether this chapter number represents
 * Lazy Source chapter 2 (pairs and lists).
 *
 * @param chapter The chapter number.
 */
export function lazyEvaluateInSource2(chapter: number): boolean {
  return chapter === LAZY_SOURCE_2
}
