//change repl chapter here

import repl = require('repl') //'repl' here refers to the module named 'repl' in index.d.ts
import { createContext, parseError, runInContext } from '../index'

const ENABLE_VERBOSE = "_enable_verbose;\n";
const DISABLE_VERBOSE = "_disable_verbose;\n";
let verbose_errors = true;


function startRepl(chapter = 1) {
  // use defaults for everything
  const context = createContext(chapter)
  repl.start( //the object being passed as argument fits the interface ReplOptions in the repl module.
	{
    	eval: (cmd, unusedContext, unusedFilename, callback) => {

			if (cmd == ENABLE_VERBOSE) {
				if (verbose_errors) {
					console.log("Verbose error messages are already enabled.");
				}
				else {
					verbose_errors = true;
					console.log("Verbose error messages enabled.");
				}
			}
			else if (cmd == DISABLE_VERBOSE) {
				if (verbose_errors) {
					verbose_errors = false;
					console.log("Verbose error messages disabled.\n");
				}
				else {
					console.log("Verbose error messages are already disabled.");
				}
			}
			else {
			
				runInContext(cmd, context, {scheduler: 'preemptive' }).then(obj => {
					if (obj.status === 'finished') {
						callback(null, obj.value)
					} else {
						callback(new Error(parseError(context.errors, verbose_errors)), undefined)
					}
				})
			}
    	}
  	})
}

function main() {

	//TODO const chapter alternative case should be 1
  const chapter = process.argv.length > 2 ? parseInt(process.argv[2], 10) : 4;
  startRepl(chapter)
}

main()
