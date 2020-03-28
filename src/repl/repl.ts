import fs = require('fs')
import repl = require('repl') // 'repl' here refers to the module named 'repl' in index.d.ts
import util = require('util')
import { createContext, IOptions, parseError, runInContext } from '../index'
import { EvaluationMethod, ExecutionMethod } from '../types'

function startRepl(
  chapter = 1,
  executionMethod: ExecutionMethod = 'interpreter',
  evaluationMethod: EvaluationMethod = 'strict',
  useSubst: boolean = false,
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
      repl.start(
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
          writer: output =>
            output.toString !== Object.prototype.toString
              ? output.toString()
              : util.inspect(output, {
                  depth: 1000,
                  colors: true
                })
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
      ['c', 'chapter=CHAPTER', 'set the Source chapter number (i.e., 1-4)'],
      ['s', 'use-subst', 'use substitution'],
      ['h', 'help', 'display this help'],
      ['n', 'native', 'use the native execution method'],
      ['l', 'lazy', 'use lazy evaluation']
    ])
    .bindHelp()
    .setHelp('Usage: node repl.js [FILENAME] [OPTION]\n\n[[OPTIONS]]')
    .parseSystem()

  const executionMethod = opt.options.native === true ? 'native' : 'interpreter'
  const evaluationMethod = opt.options.lazy === true ? 'lazy' : 'strict'
  const chapter = opt.options.chapter !== undefined ? parseFloat(opt.options.chapter) : 1
  const useSubst = opt.options.s

  if (opt.argv.length > 0) {
    fs.readFile(opt.argv[0], 'utf8', (err, data) => {
      if (err) {
        throw err
      }
      startRepl(chapter, executionMethod, evaluationMethod, useSubst, data)
    })
  } else {
    startRepl(chapter, executionMethod, evaluationMethod, useSubst, '')
  }
}

main()
