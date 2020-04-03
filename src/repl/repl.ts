#!/usr/bin/env node
import { start } from 'repl' // 'repl' here refers to the module named 'repl' in index.d.ts
import { inspect } from 'util'
import { createContext, IOptions, parseError, runInContext } from '../index'
import { EvaluationMethod, ExecutionMethod } from '../types'
import Closure from '../interpreter/closure'

function startRepl(
  chapter = 1,
  executionMethod: ExecutionMethod = 'interpreter',
  evaluationMethod: EvaluationMethod = 'strict',
  useSubst: boolean = false,
  useRepl: boolean,
  prelude = ''
) {
  // use defaults for everything
  const context = createContext(chapter)
  const options: Partial<IOptions> = {
    scheduler: 'preemptive',
    executionMethod,
    evaluationMethod,
    useSubst
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
            runInContext(cmd, context, options).then(obj => {
              if (obj.status === 'finished') {
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
      throw new Error(parseError(context.errors))
    }
  })
}

function main() {
  const opt = require('node-getopt')
    .create([
      ['c', 'chapter=CHAPTER', 'set the Source chapter number (i.e., 1-4)', '1'],
      ['s', 'use-subst', 'use substitution'],
      ['h', 'help', 'display this help'],
      ['n', 'native', 'use the native execution method'],
      ['l', 'lazy', 'use lazy evaluation'],
      ['e', 'eval', "don't show REPL, only display output of evaluation"]
    ])
    .bindHelp()
    .setHelp('Usage: js-slang [PROGRAM_STRING] [OPTION]\n\n[[OPTIONS]]')
    .parseSystem()

  const executionMethod = opt.options.native === true ? 'native' : 'interpreter'
  const evaluationMethod = opt.options.lazy === true ? 'lazy' : 'strict'
  const chapter = parseFloat(opt.options.chapter)
  const useSubst = opt.options.s
  const useRepl = !opt.options.e
  const prelude = opt.argv[0] ?? ''
  startRepl(chapter, executionMethod, evaluationMethod, useSubst, useRepl, prelude)
}

main()
