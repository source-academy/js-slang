import * as repl from 'repl'
import { createContext, runInContext } from './index'

const sourceCtxt = createContext()

function sourceEval(cmd: string, context: any, filename: any, callback: any): any {
  let promise = runInContext(cmd, sourceCtxt)
  promise.then((obj) => {
    callback(null, obj)
  })
}

export function startRepl() {
  const repl_obj = repl.start({
    prompt: '>>> ',
      eval: sourceEval
  })

  Object.defineProperty(repl_obj.context, 'WEEK', {
    configurable: false,
    value: sourceCtxt.week
  })
}
