#!/usr/bin/env node
import { start } from 'repl' // 'repl' here refers to the module named 'repl' in index.d.ts
import { inspect } from 'util'
import { createContext, IOptions, parseError, runInContext, Result, resume } from '../index'
import { Variant, ExecutionMethod } from '../types'
import Closure from '../interpreter/closure'

function startRepl(
  chapter = 1,
  executionMethod: ExecutionMethod = 'interpreter',
  variant: Variant = 'default',
  useSubst: boolean = false,
  useRepl: boolean,
  prelude = ''
) {
  // use defaults for everything
  // const context = createContext(chapter, undefined, undefined, undefined)
  // const options: Partial<IOptions> = {
  //   scheduler: 'preemptive',
  //   executionMethod,
  //   variant,
  //   useSubst
  let lastResult: Result
  let context: any
  let options: Partial<IOptions>
  if (variant === 'nondet') {
    context = createContext(2)
    options = {
      scheduler: 'nondet',
      executionMethod,
      variant,
      useSubst
    }
  } else {
    context = createContext(chapter)
    options = {
      scheduler: 'preemptive',
      executionMethod,
      variant,
      useSubst
    }
  }
  runInContext(prelude, context, options).then(preludeResult => {
    if (preludeResult.status === 'finished') {
      console.dir(preludeResult.value, { depth: null })
      if (!useRepl) {
        return
      }
      start(
        // the object being passed as argument fits the interface ReplOptions in the repl module.
        {
          eval: (cmd, unusedContext, unusedFilename, callback) => {
            if (cmd.trim() === 'try_again();') {
              ;(resume(lastResult) as Promise<Result>).then(obj2 => {
                if (obj2.status === 'finished' || obj2.status === 'suspend-nondet') {
                  callback(null, obj2.value)
                } else {
                  callback(new Error(parseError(context.errors)), undefined)
                }
              })
            } else {
              runInContext(cmd, context, options).then(obj => {
                if (obj.status === 'finished' || obj.status === 'suspend-nondet') {
                  lastResult = obj
                  callback(null, obj.value)
                } else {
                  callback(new Error(parseError(context.errors)), undefined)
                }
              })
            }
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

function main() {
  const opt = require('node-getopt')
    .create([
      ['c', 'chapter=CHAPTER', 'set the Source chapter number (i.e., 1-4)', '1'],
      ['s', 'use-subst', 'use substitution'],
      ['h', 'help', 'display this help'],
      ['i', 'interpreter', 'use the interpreter for execution'],
      ['l', 'lazy', 'use lazy evaluation'],
      ['e', 'eval', "don't show REPL, only display output of evaluation"]
    ])
    .bindHelp()
    .setHelp('Usage: js-slang [PROGRAM_STRING] [OPTION]\n\n[[OPTIONS]]')
    .parseSystem()

  const executionMethod = opt.options.interpreter === true ? 'interpreter' : 'native'
  const variant = opt.options.lazy === true ? 'lazy' : 'default'
  const chapter = parseInt(opt.options.chapter, 10)
  const useSubst = opt.options.s
  const useRepl = !opt.options.e
  const prelude = opt.argv[0] ?? ''
  startRepl(chapter, executionMethod, variant, useSubst, useRepl, prelude)
}

main()
