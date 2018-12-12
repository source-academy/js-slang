import { parseError, runInContext, createContext } from '../index'
import { Result } from '../types'
import repl = require('repl')

function startRepl(chapter = 1) {
  // use defaults for everything
  let context = createContext(chapter)
  repl.start({
    eval: (cmd, _context, _filename, callback) => {
      runInContext(cmd, context, { scheduler: 'preemptive' }).then((obj: Result) => {
        if (obj.status === 'finished') {
          callback(null, obj.value)
        } else {
          callback(new Error(parseError(context.errors)), undefined)
        }
      })
    }
  });
}

function main() {
  let chapter = process.argv.length > 2 ? parseInt(process.argv[2]) : 1
  startRepl(chapter)
}

main();
