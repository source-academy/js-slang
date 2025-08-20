import type { Program } from 'estree'

import type { SourceError } from '../errors/errorBase'
import type {Chapter, Variant  } from '../langs'
import type { Context } from '../types'
import type { Node } from '../utils/ast/node'

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
