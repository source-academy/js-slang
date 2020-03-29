import fs = require('fs')
import repl = require('repl') // 'repl' here refers to the module named 'repl' in index.d.ts
import util = require('util')
import { IOptions, parseError, runInContext } from '../index'
import { lazyEvaluateInChapter } from '../lazyContext'
import { createDefaultContextWithForcedEvaluationMethod } from '../createContext'

// if forceInterpreter is set to true, the interpreter will be run always
// if forceTranspiler is set to true, the transpiler will be run always
function startRepl(
  chapter = 1,
  forceInterpreter: boolean = false,
  forceTranspiler: boolean = false,
  useSubst: boolean,
  prelude = ''
) {
  // allow easy debugging of either the transpiler or
  // interpreter through the REPL
  const context = createDefaultContextWithForcedEvaluationMethod(
    chapter,
    forceInterpreter,
    forceTranspiler
  )
  const options: Partial<IOptions> = {
    scheduler: 'preemptive',
    useSubst
  }
  // tslint:disable-next-line: no-console
  console.log(
    'Running in mode: ' +
      (lazyEvaluateInChapter(chapter) ? 'LAZY ' : 'EAGER ') +
      (forceInterpreter ? 'INTERPRETER' : forceTranspiler ? 'TRANSPILER' : 'AUTO')
  )
  runInContext(prelude, context, options).then(preludeResult => {
    if (preludeResult.status === 'finished') {
      // tslint:disable-next-line: no-console
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
      startRepl(4, false, false, false, data)
    })
  } else {
    const chapter = process.argv.length > 2 ? parseInt(firstArg, 10) : 1
    let forceInterpreter = false
    let forceTranspiler = false
    if (process.argv.length > 3) {
      if (process.argv[3] === 'true') {
        forceInterpreter = true
      } else if (process.argv[3] !== 'false') {
        // tslint:disable-next-line: no-console
        console.log(
          'Got ' + process.argv[3] + ' for option to force interpreter (expected: true or false)'
        )
        // tslint:disable-next-line: no-console
        console.log('Setting forceInterpreter to default value: false')
      }
    }
    if (process.argv.length > 4) {
      if (process.argv[4] === 'true') {
        forceTranspiler = true
      } else if (process.argv[4] !== 'false') {
        // tslint:disable-next-line: no-console
        console.log(
          'Got ' + process.argv[4] + ' for option to force transpiler (expected: true or false)'
        )
        // tslint:disable-next-line: no-console
        console.log('Setting forceTranspiler to default value: false')
      }
    }
    const useSubst = process.argv.length > 5 ? process.argv[5] === 'subst' : false
    startRepl(chapter, forceInterpreter, forceTranspiler, useSubst)
  }
}

main()
