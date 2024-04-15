import type fslib from 'fs/promises'
import { resolve } from 'path'
import { start } from 'repl'
import { Command } from '@commander-js/extra-typings'

import { createContext, type IOptions } from '..'
import { setModulesStaticURL } from '../modules/loader'
import { Chapter, type RecursivePartial, Variant } from '../types'
import { objectValues } from '../utils/misc'
import { runCodeInSource, sourceFilesRunner } from '../runner'
import type { FileGetter } from '../modules/moduleTypes'
import {
  chapterParser,
  getChapterOption,
  getVariantOption,
  handleResult,
  validChapterVariant
} from './utils'

export const getReplCommand = () =>
  new Command('run')
    .addOption(getChapterOption(Chapter.SOURCE_4, chapterParser))
    .addOption(getVariantOption(Variant.DEFAULT, objectValues(Variant)))
    .option('-v, --verbose', 'Enable verbose errors')
    .option('--modulesBackend <backend>')
    .option('-r, --repl', 'Start a REPL after evaluating files')
    .option('--optionsFile <file>', 'Specify a JSON file to read options from')
    .argument('[filename]')
    .action(async (filename, { modulesBackend, optionsFile, repl, verbose, ...lang }) => {
      if (!validChapterVariant(lang)) {
        console.log('Invalid language combination!')
        return
      }

      const fs: typeof fslib = require('fs/promises')

      const context = createContext(lang.chapter, lang.variant)

      if (modulesBackend !== undefined) {
        setModulesStaticURL(modulesBackend)
      }

      let options: RecursivePartial<IOptions> = {}
      if (optionsFile !== undefined) {
        const rawText = await fs.readFile(optionsFile, 'utf-8')
        options = JSON.parse(rawText)
      }

      const fileGetter: FileGetter = async p => {
        try {
          const text = await fs.readFile(p, 'utf-8')
          return text
        } catch (error) {
          if (error.code === 'ENOENT') return undefined
          throw error
        }
      }

      if (filename !== undefined) {
        const entrypointFilePath = resolve(filename)
        const { result, verboseErrors } = await sourceFilesRunner(
          fileGetter,
          entrypointFilePath,
          context,
          {
            ...options,
            shouldAddFileName: true
          }
        )

        const toLog = handleResult(result, context, verbose ?? verboseErrors)
        console.log(toLog)

        if (!repl) return
      }

      start(
        // the object being passed as argument fits the interface ReplOptions in the repl module.
        {
          eval: (cmd, unusedContext, unusedFilename, callback) => {
            context.errors = []
            runCodeInSource(cmd, context, options, '/default.js', fileGetter)
              .then(obj => {
                callback(null, obj)
              })
              .catch(err => callback(err, undefined))
          },
          writer: (output: Awaited<ReturnType<typeof runCodeInSource>> | Error) => {
            if (output instanceof Error) {
              return output.message
            }

            return handleResult(output.result, context, verbose ?? output.verboseErrors)
          }
        }
      )
    })
