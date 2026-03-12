import type { Program } from 'estree'

import { Chapter, Variant } from '../langs'
import type { Context, Node, NodeTypeToNode } from '../types'
import type { RuleError } from './errors'

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
    [K in T['type']]: (node: NodeTypeToNode<K>, ancestors: Node[]) => RuleError<Node>[]
  }
}
