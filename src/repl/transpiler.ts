#!/usr/bin/env node
import fs from 'fs/promises'
import pathlib from 'path'
import { Command } from '@commander-js/extra-typings'
import { generate } from 'astring'

import { createContext, parseError } from '../index'
import { Chapter, isSourceLanguage, Variant } from '../langs'
import defaultBundler from '../modules/preprocessor/bundler'
import parseProgramsAndConstructImportGraph from '../modules/preprocessor/linker'
import { transpile } from '../transpiler/transpiler'
import { chapterParser, getChapterOption, getLanguageOption, getVariantOption } from './utils'

export const getTranspilerCommand = () =>
  new Command('transpiler')
    .addOption(getVariantOption(Variant.DEFAULT, [Variant.DEFAULT, Variant.NATIVE]))
    .addOption(getChapterOption(Chapter.SOURCE_4, chapterParser))
    .addOption(getLanguageOption())
    .option(
      '-p, --pretranspile',
      "only pretranspile (e.g. GPU -> Source) and don't perform Source -> JS transpilation"
    )
    .option('-o, --out <outFile>', 'Specify a file to write to')
    .argument('<filename>')
    .action(async (fileName, opts) => {
      if (!isSourceLanguage(opts)) {
        console.log('Invalid language combination!')
        return
      }

      const context = createContext(opts.chapter, opts.variant, opts.languageOptions)
      const entrypointFilePath = pathlib.resolve(fileName)

      const linkerResult = await parseProgramsAndConstructImportGraph(
        async p => {
          try {
            const text = await fs.readFile(p, 'utf-8')
            return text
          } catch (error) {
            if (error.code === 'ENOENT') return undefined
            throw error
          }
        },
        entrypointFilePath,
        context,
        {},
        true
      )

      if (!linkerResult.ok) {
        process.stderr.write(parseError(context.errors, linkerResult.verboseErrors))
        process.exit(1)
      }

      const { programs, topoOrder } = linkerResult
      const bundledProgram = defaultBundler(programs, entrypointFilePath, topoOrder, context)

      try {
        const transpiled = opts.pretranspile
          ? generate(bundledProgram)
          : transpile(bundledProgram, context).transpiled

        if (opts.out) {
          await fs.writeFile(opts.out, transpiled)
          console.log(`Code written to ${opts.out}`)
        } else {
          process.stdout.write(transpiled)
        }
      } catch (error) {
        process.stderr.write(parseError([error], linkerResult.verboseErrors))
        process.exit(1)
      }
    })
