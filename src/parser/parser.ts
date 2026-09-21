import type { Program } from 'estree';

import { Chapter } from '../langs';
import type { Context } from '../types';
import { FullJSParser } from './fullJS';
import { SourceParser } from './source';
import type { AcornOptions, Parser } from './types';

export function parse<TOptions extends AcornOptions>(
  programStr: string,
  context: Context,
  options?: Partial<TOptions>,
  throwOnError?: boolean,
): Program | null {
  let parser: Parser<TOptions>;
  switch (context.chapter) {
    case Chapter.FULL_JS:
      parser = new FullJSParser();
      break;
    default:
      parser = new SourceParser(context.chapter, context.variant);
  }

  const ast: Program | null = parser.parse(programStr, context, options, throwOnError);
  const validAst: boolean = !!ast && parser.validate(ast, context, throwOnError);

  return validAst ? ast : null;
}
