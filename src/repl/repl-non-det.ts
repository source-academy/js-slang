import * as fs from 'fs'
import * as repl from 'repl' // 'repl' here refers to the module named 'repl' in index.d.ts
import { inspect } from 'util'

import { CUT, TRY_AGAIN } from '../constants'
import { createContext, IOptions, parseError, Result, resume, runInContext } from '../index'
import Closure from '../interpreter/closure'
import { Chapter, Context, SuspendedNonDet, Variant } from '../types'

const NO_MORE_VALUES_MESSAGE: string = 'There are no more values of: '
let previousInput: string | undefined // stores the input which is then shown when there are no more values for the program
let previousResult: Result // stores the result obtained when execution is suspended

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
    const error = new Error(parseError(context.errors))
    // we do not display the stack trace, because the stack trace points to code within this REPL
    // program, rather than the erroneous line in the user's program. Such a trace is too low level
    // to be helpful.
    error.stack = undefined
    callback(error, undefined)
    return
  }
}

function _try_again_message(): string | undefined {
  if (previousInput) {
    const message: string = NO_MORE_VALUES_MESSAGE + previousInput
    previousInput = undefined

    return message
  } else {
    return undefined
  }
}

function _resume(
  toResume: SuspendedNonDet,
  context: Context,
  callback: (err: Error | null, result: any) => void
) {
  Promise.resolve(resume(toResume)).then((result: Result) => {
    if (result.status === 'finished') result.value = _try_again_message()
    _handleResult(result, context, callback)
  })
}

function _try_again(context: Context, callback: (err: Error | null, result: any) => void) {
  if (previousResult && previousResult.status === 'suspended-non-det') {
    _resume(previousResult, context, callback)
  } else {
    callback(null, _try_again_message())
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
    previousInput = cmd.trim()
    runInContext(cmd, context, options).then(result => {
      _handleResult(result, context, callback)
    })
  }
}

function _startRepl(chapter: Chapter = Chapter.SOURCE_1, useSubst: boolean, prelude = '') {
  // use defaults for everything
  const context = createContext(chapter, Variant.NON_DET)
  const options: Partial<IOptions> = {
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
  const firstArg = process.argv[2]
  if (process.argv.length === 3 && String(Number(firstArg)) !== firstArg.trim()) {
    fs.readFile(firstArg, 'utf8', (err, data) => {
      if (err) {
        throw err
      }
      _startRepl(Chapter.SOURCE_3, false, data)
    })
  } else {
    const chapter = Chapter.SOURCE_3
    const useSubst = process.argv.length > 3 ? process.argv[3] === 'subst' : false
    _startRepl(chapter, useSubst)
  }
}

main()
