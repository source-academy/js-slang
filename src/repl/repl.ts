import fs = require('fs')
import repl = require('repl') // 'repl' here refers to the module named 'repl' in index.d.ts
import { createContext, IOptions, parseError, runInContext } from '../index'
import { stringify } from '../utils/stringify'
import { Variant, ExecutionMethod } from '../types'

function startRepl(
  chapter = 1,
  variant: Variant,
  useSubst: boolean,
  theExecutionMethod: ExecutionMethod,
  prelude = ''
) {
  // use defaults for everything
  const context = createContext(chapter, variant)
  const options: Partial<IOptions> = {
    scheduler: 'preemptive',
    useSubst,
    executionMethod: theExecutionMethod
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
          writer: output =>
            // use stringify instead because util.inspect create super long output for functions and Closures
            // note that js-slang/utils/stringify is used in cadet-frontend
            stringify(output)
        }
      )
    } else {
      throw new Error(parseError(context.errors))
    }
  })
}

function main() {
  const firstArg = process.argv[2]
  if (process.argv.length === 3 && String(Number(firstArg)) !== firstArg.trim()) {
    fs.readFile(firstArg, 'utf8', (err, data) => {
      if (err) {
        throw err
      }
      startRepl(4, 'default', false, 'interpreter', data)
    })
  } else {
    const chapter = process.argv.length > 2 ? parseInt(firstArg, 10) : 1
    const useSubst = process.argv.length > 3 ? process.argv[3] === 'subst' : false
    const executionMethod =
      process.argv.length > 3 && process.argv[3] === 'interpreter' ? 'interpreter' : 'auto'

    const useLazyEval = !useSubst && process.argv.includes('lazy')
    startRepl(chapter, useLazyEval ? 'lazy' : 'default', useSubst, executionMethod, '')
  }
}

main()
