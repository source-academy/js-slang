import { Options, parse } from 'acorn'
import { Program } from 'estree'

import { Context } from '../..'
import { FatalSyntaxError } from '../errors'
import { Parser } from '../types'
import { positionToSourceLocation } from '../utils'

export class FullJSParser implements Parser {
  static defaultAcornOptions: Options = {
    sourceType: 'module',
    ecmaVersion: 'latest',
    locations: true
  }

  parse(programStr: string, context: Context, throwOnError: boolean): Program | null {
    try {
      return parse(programStr, FullJSParser.defaultAcornOptions) as unknown as Program
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(positionToSourceLocation((error as any).loc), error.toString())
      }

      if (throwOnError) throw error
      context.errors.push(error)
    }

    return null
  }
  validate(_ast: Program, _context: Context, _throwOnError: boolean): boolean {
    return true
  }
}
