import { parse } from 'acorn'
import { Program } from 'estree'

import { Context } from '../..'
import { FatalSyntaxError } from '../errors'
import { Parser } from '../types'
import { createAcornParserOptions, positionToSourceLocation } from '../utils'

export class FullJSParser implements Parser {
  parse(programStr: string, context: Context, throwOnError?: boolean): Program | null {
    try {
      return parse(programStr, createAcornParserOptions('latest')) as unknown as Program
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
