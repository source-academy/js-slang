import { Program } from 'estree'

import { Context } from '..'
import { Chapter, Variant } from '../types'
import { FullJSParser } from './fullJS'
import { SourceParser } from './source'
import { SourceTypedParser } from './source/typed'
import { AcornOptions, Parser } from './types'

export function parse<TOptions extends AcornOptions>(
  programStr: string,
  context: Context,
  options?: Partial<TOptions>,
  throwOnError?: boolean
): Program | null {
  let parser: Parser<TOptions>
  switch (context.chapter) {
    case Chapter.FULL_JS:
      parser = new FullJSParser()
      break
    default:
      switch (context.variant) {
        case Variant.TYPED:
          parser = new SourceTypedParser(context.chapter, context.variant)
          break
        default:
          parser = new SourceParser(context.chapter, context.variant)
      }
  }

  const ast: Program | null = parser.parse(programStr, context, options, throwOnError)
  const validAst: boolean = !!ast && parser.validate(ast, context, throwOnError)

  return validAst ? ast : null
}
