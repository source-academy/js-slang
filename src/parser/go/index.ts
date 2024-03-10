import { FatalSyntaxError } from '../errors'
import { Parser } from '../types'
import { parse } from '../../go-slang/parser/go.js'

export class GoParser implements Parser<any> {
  parse(programStr: string, context: any, options?: any, throwOnError?: boolean): any {
    try {
      return parse(programStr)
    } catch (error) {
      const location = error.location
      error = new FatalSyntaxError(
        {
          start: { line: location.start.line, column: location.start.column },
          end: { line: location.end.line, column: location.end.column },
          source: location.source
        },
        error.toString()
      )

      if (throwOnError) throw error
      context.errors.push(error)
    }

    return null
  }
  validate(ast: any, context: any, throwOnError?: boolean): boolean {
    return true
  }
}
