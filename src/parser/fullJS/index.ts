import { parse } from 'acorn'
import type { Program } from 'estree'

import type { Context } from '../..'
import { FatalSyntaxError } from '../errors'
import type { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'

export class FullJSParser implements Parser<AcornOptions> {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    try {
      return parse(programStr, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...options
      }) as unknown as Program
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

  toString(): string {
    return 'FullJSParser'
  }
}
