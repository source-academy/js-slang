import type { Program } from 'estree'

import { Chapter, Context, ErrorSeverity, ErrorType, Node, SourceError, Variant } from '../types'
import { UNKNOWN_LOCATION } from '../constants'

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
  name: string
  disableFromChapter?: Chapter
  disableForVariants?: Variant[]
  checkers: {
    [name: string]: (node: T, ancestors: Node[]) => SourceError[]
  }
  /**
   * Test snippets to test the behaviour of the rule. Providing no test snippets
   * means that this rule will not be tested when running unit tests.\
   * First element of the tuple is the code to test. Set the second element to `undefined`
   * if the snippet should not throw an error. Otherwise set it to the `explain()` value
   * of the error.
   */
  testSnippets?: [code: string, expected: string | undefined][]
}

export abstract class RuleError<T extends Node> implements SourceError {
  public readonly type = ErrorType.SYNTAX
  public readonly severity = ErrorSeverity.ERROR

  constructor(public readonly node: T) {}

  public get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public abstract explain(): string
  public abstract elaborate(): string
}
