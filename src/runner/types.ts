import type { Program } from 'estree'
import type { Context, IOptions, Result } from '..'

export type Runner = (program: Program, context: Context, options: IOptions) => Promise<Result>
