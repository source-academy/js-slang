#! /bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

'use strict';

const repl = require('./lib/repl.js')
const program = require('commander');
program
  .version('slang 0.0.1a', '-v, --version')
  .parse(process.argv);

repl.startRepl();
