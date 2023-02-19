import { parse as babelParse } from '@babel/parser'
import { Options as AcornOptions } from 'acorn'
import { Program } from 'estree'

import { Context } from '../../..'
import { DEFAULT_ECMA_VERSION } from '../../../constants'
import * as TypedES from '../../../typeChecker/tsESTree'
import { checkForTypeErrors } from '../../../typeChecker/typeErrorChecker'
import { FatalSyntaxError } from '../../errors'
import { BabelOptions } from '../../types'
import { createAcornParserOptions, positionToSourceLocation } from '../../utils'
import { SourceParser } from '..'
import TypeParser from './typeParser'
import { transformBabelASTToESTreeCompliantAST } from './utils'

export class SourceTypedParser extends SourceParser {
  static defaultBabelOptions: BabelOptions = {
    sourceType: 'module',
    plugins: ['typescript', 'estree']
  }

  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    TypeParser.parse(
      programStr,
      createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors, options)
    )

    const ast = babelParse(programStr, {
      ...SourceTypedParser.defaultBabelOptions,
      sourceFilename: options?.sourceFile,
      errorRecovery: throwOnError ?? true
    })

    if (ast.errors.length) {
      ast.errors
        .filter(error => error instanceof SyntaxError)
        .forEach(error => {
          context.errors.push(
            new FatalSyntaxError(
              positionToSourceLocation((error as any).loc, options?.sourceFile),
              error.toString()
            )
          )
        })

      return null
    }

    const typedProgram: TypedES.Program = ast.program as TypedES.Program
    const typedCheckedProgram: Program = checkForTypeErrors(typedProgram, context)
    transformBabelASTToESTreeCompliantAST(typedCheckedProgram)

    return typedCheckedProgram
  }

  toString(): string {
    return 'SourceTypedParser'
  }
}
