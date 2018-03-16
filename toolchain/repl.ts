import * as repl from 'repl'
import { createContext, runInContext } from './index'

const sourceCtxt = createContext()

function fmtError(ctxt: any): string {
  let error = ctxt.errors[0]
  let line = error.location.start.line
  let char = error.location.start.column
  let errType = error.type + error.severity
  return errType + ' at ' + line + ':' + char
}

function sourceEval(cmd: string, context: any, filename: any, callback: any): any {
  let promise = runInContext(cmd, sourceCtxt)
  promise.then((obj) => {
    if (obj.status == 'finished') {
      callback(null, obj.value)
    } else {
      callback(fmtError(sourceCtxt), null)
    }
  })
}

export function startRepl() {
  repl.start({
    prompt: '>>> ',
      eval: sourceEval
  })
  runInContext('var __week__ = ' + sourceCtxt.week + ';', sourceCtxt)
}
