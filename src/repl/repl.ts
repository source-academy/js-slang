#!/usr/bin/env node
import { start } from 'repl' // 'repl' here refers to the module named 'repl' in index.d.ts
import { inspect } from 'util'

import { pyLanguages, scmLanguages, sourceLanguages } from '../constants'
import { createContext, IOptions, parseError, runInContext } from '../index'
import Closure from '../interpreter/closure'
import { ExecutionMethod, Variant } from '../types'

function startRepl(
  chapter = 1,
  executionMethod: ExecutionMethod = 'interpreter',
  variant: Variant = Variant.DEFAULT,
  useSubst: boolean = false,
  useRepl: boolean,
  prelude = ''
) {
  // use defaults for everything
  const context = createContext(chapter, variant, undefined, undefined)
  const options: Partial<IOptions> = {
    scheduler: 'preemptive',
    executionMethod,
    variant,
    useSubst
  }
  runInContext(prelude, context, options).then(preludeResult => {
    if (preludeResult.status === 'finished' || preludeResult.status === 'suspended-non-det') {
      console.dir(preludeResult.value, { depth: null })
      if (!useRepl) {
        return
      }
      start(
        // the object being passed as argument fits the interface ReplOptions in the repl module.
        {
          eval: (cmd, unusedContext, unusedFilename, callback) => {
            runInContext(cmd, context, options).then(obj => {
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
    } else {
      console.error(parseError(context.errors))
    }
  })
}

/**
 * Returns true iff the given chapter and variant combination is supported.
 */
function validChapterVariant(chapter: any, variant: any) {
  if (variant === 'interpreter') {
    return true
  }
  // TODO explicit control should only be done with source chapter 4
  if (variant === 'explicit-control') {
    return true
  }
  if (variant === 'substituter' && (chapter === 1 || chapter === 2)) {
    return true
  }
  for (const lang of sourceLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }
  for (const lang of scmLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }
  for (const lang of pyLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }

  return false
}

function main() {
  const opt = require('node-getopt')
    .create([
      ['c', 'chapter=CHAPTER', 'set the Source chapter number (i.e., 1-4)', '1'],
      [
        'v',
        'variant=VARIANT',
        'set the Source variant (i.e., default, interpreter, substituter, lazy, non-det, concurrent, wasm, gpu)',
        'default'
      ],
      ['h', 'help', 'display this help'],
      ['e', 'eval', "don't show REPL, only display output of evaluation"]
    ])
    .bindHelp()
    .setHelp('Usage: js-slang [PROGRAM_STRING] [OPTION]\n\n[[OPTIONS]]')
    .parseSystem()

  const variant = opt.options.variant
  const chapter = parseInt(opt.options.chapter, 10)
  const areValidChapterVariant: boolean = validChapterVariant(chapter, variant)
  if (!areValidChapterVariant) {
    throw new Error(
      'The chapter and variant combination provided is unsupported. Use the -h option to view valid chapters and variants.'
    )
  }

  const executionMethod =
    opt.options.variant === 'interpreter' ||
    opt.options.variant === 'non-det' ||
    opt.options.variant === 'explicit-control'
      ? 'interpreter'
      : 'native'
  const useSubst = opt.options.variant === 'substituter'
  const useRepl = !opt.options.e
  const prelude = opt.argv[0] ?? ''
  startRepl(chapter, executionMethod, variant, useSubst, useRepl, prelude)
}

main()
