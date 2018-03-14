import * as repl from 'repl'
import { createContext, runInContext } from './index'

const sourceCtxt = createContext()

function sourceEval(cmd: string, context: any, filename: any, callback: any): any {
  let promise = runInContext(cmd, sourceCtxt)
  promise.then((obj) => {
    if (obj.status == 'finished') {
      callback(null, obj.value)
    } else {
      callback(obj.status, null)
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
