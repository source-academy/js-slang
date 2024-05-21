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
  name: string
  testSnippets?: [string, string][]

  disableFromChapter?: Chapter
  disableForVariants?: Variant[]
  checkers: {
    [name: string]: (node: T, ancestors: Node[]) => SourceError[]
  },
}
