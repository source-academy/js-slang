import { parse as babelParse, ParserOptions as babelOptions } from '@babel/parser'
import { Program } from 'estree'

import { Context } from '../../..'
import { DEFAULT_ECMA_VERSION } from '../../../constants'
import * as TypedES from '../../../typeChecker/tsESTree'
import { checkForTypeErrors } from '../../../typeChecker/typeErrorChecker'
import { createAcornParserOptions } from '../../utils'
import { SourceParser } from '..'
import TypeParser from './typeParser'

export class SourceTypedParser extends SourceParser {
  static defaultBabelOptions: babelOptions = {
    sourceType: 'module',
    plugins: ['typescript', 'estree']
  }

  parse(programStr: string, context: Context, _throwOnError?: boolean): Program | null {
    TypeParser.parse(programStr, createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors))

    const typedProgram: TypedES.Program = babelParse(
      programStr,
      SourceTypedParser.defaultBabelOptions
    ).program as unknown as TypedES.Program

    return checkForTypeErrors(typedProgram, context)
  }
}
