#!/usr/bin/env node
import type fslib from 'fs/promises'
import { resolve } from 'path'
import { Command } from '@commander-js/extra-typings'
import { generate } from 'astring'

import { transpileToGPU } from '../gpu/gpu'
import { createContext, parseError } from '../index'
import { transpileToLazy } from '../lazy/lazy'
import defaultBundler from '../modules/preprocessor/bundler'
import parseProgramsAndConstructImportGraph from '../modules/preprocessor/linker'
import { transpile } from '../transpiler/transpiler'
import { Chapter, Variant } from '../types'
import {
  chapterParser,
  getChapterOption,
  getVariantOption,
  validateChapterAndVariantCombo
} from './utils'

export const transpilerCommand = new Command()
  .addOption(
    getVariantOption(Variant.DEFAULT, [Variant.DEFAULT, Variant.GPU, Variant.LAZY, Variant.NATIVE])
  )
  .addOption(getChapterOption(Chapter.SOURCE_4, chapterParser))
  .option(
    '-p, --pretranspile',
    "only pretranspile (e.g. GPU -> Source) and don't perform Source -> JS transpilation"
  )
  .option('-o, --out <outFile>', 'Specify a file to write to')
  .argument('<filename>')
  .action(async (fileName, opts) => {
    if (!validateChapterAndVariantCombo(opts)) {
      console.log('Invalid language combination!')
      return
    }

    const fs: typeof fslib = require('fs/promises')
    const context = createContext(opts.chapter, opts.variant)
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
      console.log(parseError(context.errors, linkerResult.verboseErrors))
      return
    }

    const { programs, topoOrder } = linkerResult
    const bundledProgram = defaultBundler(programs, entrypointFilePath, topoOrder, context)

    switch (opts.variant) {
      case Variant.GPU:
        transpileToGPU(bundledProgram)
        break
      case Variant.LAZY:
        transpileToLazy(bundledProgram)
        break
    }

    const transpiled = opts.pretranspile
      ? generate(bundledProgram)
      : transpile(bundledProgram, context).transpiled

    if (context.errors.length > 0) {
      console.log(parseError(context.errors, linkerResult.verboseErrors))
      return
    }

    if (opts.out) {
      const resolvedOut = resolve(opts.out)
      await fs.writeFile(resolvedOut, transpiled)
      console.log(`Code written to ${resolvedOut}`)
    } else {
      console.log(transpiled)
    }
  })
