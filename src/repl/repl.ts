import type fslib from 'fs/promises'
import { resolve } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import { Command } from '@commander-js/extra-typings'

import { createContext, type IOptions, parseError, runInContext } from '..'
import Closure from '../interpreter/closure'
import { setModulesStaticURL } from '../modules/loader'
import { Chapter, type RecursivePartial, Variant } from '../types'
import { objectValues } from '../utils/misc'
import { stringify } from '../utils/stringify'
import { sourceFilesRunner } from '../runner'
import { Representation } from '../alt-langs/mapper'
import { chapterParser, getChapterOption, getVariantOption, validChapterVariant } from './utils'

export const replCommand = new Command('run')
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

    if (filename !== undefined) {
      const entrypointFilePath = resolve(filename)
      const { result, verboseErrors } = await sourceFilesRunner(
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
        {
          ...options,
          shouldAddFileName: true
        }
      )

      if (result.status === 'finished') {
        console.log(stringify(result.value))
      } else if (result.status === 'error') {
        console.log(parseError(context.errors, verbose || verboseErrors))
      }

      if (!repl) return
    }

    start(
      // the object being passed as argument fits the interface ReplOptions in the repl module.
      {
        eval: (cmd, unusedContext, unusedFilename, callback) => {
          context.errors = []
          runInContext(cmd, context, options).then(obj => {
            if (obj.status === 'finished' || obj.status === 'suspended-non-det') {
              callback(null, obj.representation !== undefined ? obj.representation : obj.value)
            } else {
              callback(new Error(parseError(context.errors)), undefined)
            }
          })
        },
        // set depth to a large number so that `parse()` output will not be folded,
        // setting to null also solves the problem, however a reference loop might crash
        writer: output => {
          return output instanceof Closure ||
              typeof output === 'function' ||
              output instanceof Representation
              ? output.toString()
              : inspect(output, {
                  depth: 1000,
                  colors: true
                })
        }
      }
    )
  })
