import { ParserOptions } from '@babel/parser'
import { Options } from 'acorn'
import { Program } from 'estree'

import { Context } from '../types'

export type AcornOptions = Options
export type BabelOptions = ParserOptions

export interface Parser<TOptions> {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<TOptions>,
    throwOnError?: boolean
  ): Program | null
  validate(ast: Program, context: Context, throwOnError?: boolean): boolean
}
