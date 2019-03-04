import repl = require('repl') // 'repl' here refers to the module named 'repl' in index.d.ts
import { createContext, parseError, runInContext } from '../index'

function startRepl(chapter = 1) {
  // use defaults for everything
  const context = createContext(chapter)
  repl.start(
    // the object being passed as argument fits the interface ReplOptions in the repl module.
    {
      eval: (cmd, unusedContext, unusedFilename, callback) => {
        runInContext(cmd, context, { scheduler: 'preemptive' }).then(obj => {
          if (obj.status === 'finished') {
            callback(null, obj.value)
          } else {
            callback(new Error(parseError(context.errors)), undefined)
          }
        })
      }
    }
  )
}

function main() {
  const chapter = process.argv.length > 2 ? parseInt(process.argv[2], 10) : 1
  startRepl(chapter)
}

main()
