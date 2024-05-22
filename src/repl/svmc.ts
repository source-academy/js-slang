import pathlib from 'path'
import type fslib from 'fs/promises'

import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings'
import { createEmptyContext } from '../createContext'
import { parse } from '../parser/parser'
import { INTERNAL_FUNCTIONS as concurrentInternalFunctions } from '../stdlib/vm.prelude'
import { Chapter, Variant } from '../types'
import { stripIndent } from '../utils/formatters'
import { parseError } from '..'
import { assemble } from '../vm/svml-assembler'
import { compileToIns } from '../vm/svml-compiler'
import { stringifyProgram } from '../vm/util'
import { chapterParser, getChapterOption, getVariantOption } from './utils'

const compileToChoices = ['ast', 'binary', 'debug', 'json'] as const

export const getSVMCCommand = () =>
  new Command('svmc')
    .argument('<inputFile>', 'File to read code from')
    .addOption(getChapterOption(Chapter.SOURCE_3, chapterParser))
    .addOption(getVariantOption(Variant.DEFAULT, [Variant.DEFAULT, Variant.CONCURRENT]))
    .addOption(
      new Option(
        '-t, --compileTo <compileOption>',
        stripIndent`
      json: Compile only, but don't assemble.
      binary: Compile and assemble.
      debug: Compile and pretty-print the compiler output. For debugging the compiler.
      ast: Parse and pretty-print the AST. For debugging the parser.`
      )
        .choices(compileToChoices)
        .default('binary' as (typeof compileToChoices)[number])
    )
    .option(
      '-o, --out <outFile>',
      stripIndent`
      Sets the output filename.
      Defaults to the input filename, minus any '.js' extension, plus '.svm'.
    `
    )
    .addOption(
      new Option(
        '-i, --internals <names>',
        `Sets the list of VM-internal functions. The argument should be a JSON array of
strings containing the names of the VM-internal functions.`
      )
        .argParser(value => {
          const parsed = JSON.parse(value)
          if (!Array.isArray(parsed)) {
            throw new InvalidArgumentError('Expected a JSON array of strings!')
          }

          for (const each of parsed) {
            if (typeof each !== 'string') {
              throw new InvalidArgumentError('Expected a JSON array of strings!')
            }
          }
          return parsed as string[]
        })
        .default([] as string[])
    )
    .action(async (inputFile, opts) => {
      const fs: typeof fslib = require('fs/promises')

      if (opts.variant === Variant.CONCURRENT && opts.internals) {
        console.warn(
          'Warning: ignoring internal functions specified on command line for concurrent VM'
        )
      }

      const vmInternalFunctions =
        opts.variant === Variant.CONCURRENT
          ? concurrentInternalFunctions.map(([name]) => name)
          : opts.internals || []

      const source = await fs.readFile(inputFile, 'utf-8')
      const context = createEmptyContext(opts.chapter, opts.variant, [], null)
      const program = parse(source, context)
      if (program === null) {
        console.error(parseError(context.errors))
        process.exit(1)
      }

      // the current compiler does not differentiate between chapters 1, 2 or 3
      const compiled = compileToIns(program, undefined, vmInternalFunctions)
      switch (opts.compileTo) {
        case 'ast': {
          console.log(JSON.stringify(program, undefined, 2))
          return
        }
        case 'debug': {
          console.log(stringifyProgram(compiled).trimEnd())
          return
        }
        case 'json': {
          console.log(JSON.stringify(compiled))
          return
        }
      }

      const binary = assemble(compiled)
      const outputFilename = opts.out ?? `${pathlib.basename(inputFile)}.svm`
      return fs.writeFile(outputFilename, binary)
    })
