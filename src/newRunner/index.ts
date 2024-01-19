import { Program } from 'estree'

import { Context, IOptions, Result } from '..'

/**
 * What a runner needs to do:
 * 1. Validate and Annotate?
 * 2. Determine Verbose Errors?
 * 3. Run and return result
 * 4. Error handling?
 */
export type Runner<TResult = Result> = (program: Program, context: Context, options: IOptions) => Promise<TResult>
