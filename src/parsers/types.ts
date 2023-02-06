import { Program } from 'estree'

import { Context } from '../types'

export interface Parser {
  parse(programStr: string, context: Context, throwOnError?: boolean): Program | null
  validate(ast: Program, context: Context, throwOnError?: boolean): boolean
}
