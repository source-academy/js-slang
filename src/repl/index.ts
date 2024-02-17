import type fslib from 'fs/promises'
import { Command } from '@commander-js/extra-typings'
import { chapterOption, variantOption } from './utils'
import { createContext, parseError, runInContext } from '..'
import { resolve } from 'path'
import { runFilesInSource } from '../runner'
import type { AbsolutePath } from '../modules/moduleTypes'
import { stringify } from '../utils/stringify'
import { start } from 'repl'
import { inspect } from 'util'
import Closure from '../interpreter/closure'
import { setModulesStaticURL } from '../modules/loader'

new Command()
  .addOption(chapterOption)
  .addOption(variantOption)
  .option('-v, --verbose', 'Enable verbose errors')
  .option('--modulesBackend <backend>')
  .option('-r, --repl', 'Start a REPL after evaluating the files')
  .argument('[filename]')
  .action(async (filename, opts) => {
    const fs: typeof fslib = require('fs/promises')

    const context = createContext(opts.chapter, opts.variant)

    if (opts.modulesBackend !== undefined) {
      setModulesStaticURL(opts.modulesBackend)
    }

    if (filename !== undefined) {
      const entrypointFilePath = resolve(filename) as AbsolutePath
      const result = await runFilesInSource(
        p => fs.readFile(p, 'utf-8'),
        entrypointFilePath,
        context
      )

      if (result.status === 'finished') {
        console.log(stringify(result.value))
      } else if (result.status === 'error') {
        console.log(parseError(context.errors, opts.verbose))
      }

      if (!opts.repl) return
    }

    start(
      // the object being passed as argument fits the interface ReplOptions in the repl module.
      {
        eval: (cmd, unusedContext, unusedFilename, callback) => {
          context.errors = []
          runInContext(cmd, context).then(obj => {
            if (obj.status === 'finished' || obj.status === 'suspended-non-det') {
              callback(null, obj.value)
            } else {
              callback(new Error(parseError(context.errors)), undefined)
            }
          })
        },
        // set depth to a large number so that `parse()` output will not be folded,
        // setting to null also solves the problem, however a reference loop might crash
        writer: output => {
          return output instanceof Closure || typeof output === 'function'
            ? output.toString()
            : inspect(output, {
                depth: 1000,
                colors: true
              })
        }
      }
    )
  })
  .parseAsync()
