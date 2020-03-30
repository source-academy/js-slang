import fs = require('fs')
import repl = require('repl') // 'repl' here refers to the module named 'repl' in index.d.ts
import util = require('util')
import { createContext, IOptions, parseError, runInContext, resume, Result } from '../index'
import { SuspendedNonDet, Context } from '../types'
import { CUT, TRY_AGAIN } from '../constants'

// stores the result obtained when execution is suspended
let previousResult: Result
function _handleResult(
  result: Result,
  context: Context,
  callback: (err: Error | null, result: any) => void
) {
  if (result.status === 'finished' || result.status === 'suspended-non-det') {
    previousResult = result

    if (result.value === CUT) result.value = undefined
    callback(null, result.value)
  } else {
    callback(new Error(parseError(context.errors)), undefined)
    return
  }
}

function _resume(
  toResume: SuspendedNonDet,
  context: Context,
  callback: (err: Error | null, result: any) => void
) {
  Promise.resolve(resume(toResume)).then((result: Result) => {
    _handleResult(result, context, callback)
  })
}

function _try_again(context: Context, callback: (err: Error | null, result: any) => void) {
  if (previousResult && previousResult.status === 'suspended-non-det') {
    _resume(previousResult, context, callback)
  } else {
    callback(null, undefined)
  }
}

function _run(
  cmd: string,
  context: Context,
  options: Partial<IOptions>,
  callback: (err: Error | null, result: any) => void
) {
  if (cmd.trim() === TRY_AGAIN) {
    _try_again(context, callback)
  } else {
    runInContext(cmd, context, options).then(result => {
      _handleResult(result, context, callback)
    })
  }
}

function _startRepl(chapter = 1, useSubst: boolean, prelude = '') {
  // use defaults for everything
  const context = createContext(chapter)
  const options: Partial<IOptions> = {
    scheduler: 'non-det',
    executionMethod: 'interpreter',
    useSubst
  }
  runInContext(prelude, context, options).then(preludeResult => {
    if (preludeResult.status === 'finished' || preludeResult.status === 'suspended-non-det') {
      console.dir(preludeResult.value, { depth: null })

      repl.start(
        // the object being passed as argument fits the interface ReplOptions in the repl module.
        {
          eval: (cmd, unusedContext, unusedFilename, callback) => {
            _run(cmd, context, options, callback)
          },
          // set depth to a large number so that `parse()` output will not be folded,
          // setting to null also solves the problem, however a reference loop might crash
          writer: output =>
            util.inspect(output, {
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
  const firstArg = process.argv[2]
  if (process.argv.length === 3 && String(Number(firstArg)) !== firstArg.trim()) {
    fs.readFile(firstArg, 'utf8', (err, data) => {
      if (err) {
        throw err
      }
      _startRepl(4.3, false, data)
    })
  } else {
    const chapter = 4.3
    const useSubst = process.argv.length > 3 ? process.argv[3] === 'subst' : false
    _startRepl(chapter, useSubst)
  }
}

main()
