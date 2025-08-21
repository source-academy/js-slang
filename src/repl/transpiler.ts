#!/usr/bin/env node
import fs from 'fs/promises'
import { resolve } from 'path'
import { Command } from '@commander-js/extra-typings'
import { generate } from 'astring'

import { createContext, parseError } from '../index'
import { Chapter, Variant, isSourceLanguage } from '../langs'
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
    .action(async (fileName, { pretranspile, out, ...lang }) => {
      if (!isSourceLanguage(lang)) {
        console.log('Invalid language combination!')
        return
      }

      const context = createContext(lang.chapter, lang.variant, lang.languageOptions)
      const entrypointFilePath = resolve(fileName)

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
        const transpiled = pretranspile
          ? generate(bundledProgram)
          : transpile(bundledProgram, context).transpiled

        if (out) {
          await fs.writeFile(out, transpiled)
          console.log(`Code written to ${out}`)
        } else {
          process.stdout.write(transpiled)
        }
      } catch (error) {
        process.stderr.write(parseError([error], linkerResult.verboseErrors))
        process.exit(1)
      }
    })
