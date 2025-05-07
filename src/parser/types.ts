import type { Program } from 'estree'

import type { Context, Chapter, Node, SourceError, Variant } from '../types'

export type { Options as AcornOptions } from 'acorn'
export type { ParserOptions as BabelOptions } from '@babel/parser'

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
}
