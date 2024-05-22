import type { Program } from 'estree'

import type { Context, Node, Chapter, Variant, SourceError } from '../types'

export type { ParserOptions as BabelOptions } from '@babel/parser'
export type { Options as AcornOptions } from 'acorn'

export interface Parser<TOptions> {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<TOptions>,
    throwOnError?: boolean
  ): Program | null
  validate(ast: Program, context: Context, throwOnError?: boolean): boolean
}
export interface Rule<T extends Node> {
  /**
   * Name of the rule
   */
  name: string

  /**
   * Test snippets to test the behaviour of the rule. Providing no test snippets
   * means that this rule will not be tested when running unit tests.\
   * First element of the tuple is the code to test. Set the second element to `undefined`
   * if the snippet should not throw an error. Otherwise set it to the `explain()` value
   * of the error.
   */
  testSnippets?: [code: string, expected: string | undefined][]

  /**
   * Disable this rule for this chapter (inclusive) and above
   */
  disableFromChapter?: Chapter
  disableForVariants?: Variant[]
  checkers: {
    [name: string]: (node: T, ancestors: Node[]) => SourceError[]
  }
}
