import { parse as babelParse } from '@babel/parser'
import { createProjectSync, ts } from '@ts-morph/bootstrap'
import { Program } from 'estree'

import { Context } from '../..'
import * as TypedES from '../../typeChecker/tsESTree'
import { removeTSNodes } from '../../typeChecker/typeErrorChecker'
import { FatalSyntaxError } from '../errors'
import { transformBabelASTToESTreeCompliantAST } from '../source/typed/utils'
import { AcornOptions, Parser } from '../types'
import { defaultBabelOptions, positionToSourceLocation } from '../utils'

export class FullTSParser implements Parser<AcornOptions> {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    // Initialize file to analyze
    const project = createProjectSync({ useInMemoryFileSystem: true })
    const filename = 'program.ts'
    project.createSourceFile(filename, programStr)

    // Get TS diagnostics from file, formatted as TS error string
    const diagnostics = ts.getPreEmitDiagnostics(project.createProgram())
    const formattedString = project.formatDiagnosticsWithColorAndContext(diagnostics)

    // Reformat TS error string to Source error by getting line number using regex
    // This is because logic to retrieve line number is only present in
    // formatDiagnosticsWithColorAndContext and cannot be called directly
    const lineNumRegex = /(?<=\[7m)\d+/
    diagnostics.forEach(diagnostic => {
      const message = diagnostic.messageText.toString()
      const lineNum = lineNumRegex.exec(formattedString.split(message)[1])
      const position = { line: lineNum === null ? 0 : parseInt(lineNum[0]), column: 0, offset: 0 }
      context.errors.push(new FatalSyntaxError(positionToSourceLocation(position), message))
    })

    if (context.errors.length > 0) {
      return null
    }

    // Parse code into Babel AST, which supports type syntax
    const ast = babelParse(programStr, {
      ...defaultBabelOptions,
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

    // Transform Babel AST into ESTree AST
    const typedProgram: TypedES.Program = ast.program as TypedES.Program
    const transpiledProgram: Program = removeTSNodes(typedProgram)
    transformBabelASTToESTreeCompliantAST(transpiledProgram)

    return transpiledProgram
  }

  validate(_ast: Program, _context: Context, _throwOnError: boolean): boolean {
    return true
  }

  toString(): string {
    return 'FullTSParser'
  }
}
