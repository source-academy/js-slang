import { Program } from 'estree'

import { Context } from '..'
import { Chapter, Variant } from '../types'
import { FullJSParser } from './fullJS'
import { SourceParser } from './source'
import { SourceTypedParser } from './source/typed'
import { Parser } from './types'

export function parse(
  programStr: string,
  context: Context,
  throwOnError?: boolean
): Program | null {
  let parser: Parser
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

  const ast: Program | null = parser.parse(programStr, context, throwOnError)
  if (ast) parser.validate(ast, context, throwOnError)

  return ast
}
