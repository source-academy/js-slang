import repl = require('repl')
import { createContext, parseError, runInContext } from '../index'
import { Result } from '../types'

function startRepl(chapter = 1) {
  // use defaults for everything
  const context = createContext(chapter)
  repl.start({
    eval: (cmd, unusedContext, unusedFilename, callback) => {
      runInContext(cmd, context, { scheduler: 'preemptive' }).then((obj: Result) => {
        if (obj.status === 'finished') {
          callback(null, obj.value)
        } else {
          callback(new Error(parseError(context.errors)), undefined)
        }
      })
    }
  })
}

function main() {
  const chapter = process.argv.length > 2 ? parseInt(process.argv[2], 10) : 1
  startRepl(chapter)
}

main()
