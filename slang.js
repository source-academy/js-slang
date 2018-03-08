#! /bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

'use strict';

const repl = require('./lib/repl.js')
const program = require('commander');
program
  .version('slang 0.1.0', '-v, --version')
  .parse(process.argv);

repl.startRepl();
