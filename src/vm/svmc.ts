import fs = require('fs')
import util = require('util')

import { parse } from '../parser/parser'
import { createEmptyContext } from '../createContext'
import { compileToIns } from './svml-compiler'
import { assemble } from './svml-assembler'
import { stringifyProgram } from './util'

interface CliOptions {
  compileTo: 'debug' | 'json' | 'binary' | 'ast'
  sourceChapter: 1 | 2 | 3 | 3.4
  inputFilename: string
  outputFilename: string | null
}

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

// This is a console program. We're going to print.
/* tslint:disable:no-console */

function parseOptions(): CliOptions | null {
  const ret: CliOptions = {
    compileTo: 'binary',
    sourceChapter: 3,
    inputFilename: '',
    outputFilename: null
  }

  let endOfOptions = false
  let error = false
  const args = process.argv.slice(2)
  while (args.length > 0) {
    let option = args[0]
    let argument = args[1]
    let argShiftNumber = 2
    if (!endOfOptions && option.startsWith('--') && option.includes('=')) {
      ;[option, argument] = option.split('=')
      argShiftNumber = 1
    }
    if (!endOfOptions && option.startsWith('-')) {
      switch (option) {
        case '--compile-to':
        case '-t':
          switch (argument) {
            case 'debug':
            case 'json':
            case 'binary':
            case 'ast':
              ret.compileTo = argument
              break
            default:
              console.error('Invalid argument to --compile-to: %s', argument)
              error = true
              break
          }
          args.splice(0, argShiftNumber)
          break
        case '--chapter':
        case '-c':
          const argFloat = parseFloat(argument)
          if (argFloat === 1 || argFloat === 2 || argFloat === 3 || argFloat === 3.4) {
            ret.sourceChapter = argFloat
          } else {
            console.error('Invalid Source chapter: %d', argFloat)
            error = true
          }
          args.splice(0, argShiftNumber)
          break
        case '--out':
        case '-o':
          ret.outputFilename = argument
          args.splice(0, argShiftNumber)
          break
        case '--':
          endOfOptions = true
          args.shift()
          break
        default:
          console.error('Unknown option %s', option)
          args.shift()
          error = true
          break
      }
    } else {
      if (ret.inputFilename === '') {
        ret.inputFilename = args[0]
      } else {
        console.error('Excess non-option argument: %s', args[0])
        error = true
      }
      args.shift()
    }
  }

  if (ret.inputFilename === '') {
    console.error('No input file specified')
    error = true
  }

  return error ? null : ret
}

async function main() {
  const options = parseOptions()
  if (options == null) {
    console.error(`Usage: svmc [options...] <input file>

Options:
-t, --compile-to <option>: [binary]
  json: Compile only, but don't assemble.
  binary: Compile and assemble.
  debug: Compile and pretty-print the compiler output. For debugging the compiler.
  ast: Parse and pretty-print the AST. For debugging the parser.
-c, --chapter <chapter>: [3]
  1, 2, 3, or 3.4 (Source 3 Concurrent). Sets the Source chapter.
-o, --out <filename>: [see below]
  Sets the output filename.
  Defaults to the input filename, minus any '.js' extension, plus '.svm'.
--:
  Signifies the end of arguments, in case your input filename starts with -.`)
    process.exitCode = 1
    return
  }

  const source = await readFileAsync(options.inputFilename, 'utf8')
  const context = createEmptyContext(options.sourceChapter, [], null)
  const program = parse(source, context)

  let numWarnings = 0
  let numErrors = 0
  for (const error of context.errors) {
    console.error(
      '[%s] (%d:%d) %s',
      error.severity,
      error.location.start.line,
      error.location.start.column,
      error.explain()
    )
    switch (error.severity) {
      case 'Warning':
        ++numWarnings
        break
      case 'Error':
        ++numErrors
        break
    }
  }

  if (numWarnings > 0 || numErrors > 0) {
    console.error('%d warning(s) and %d error(s) produced.', numWarnings, numErrors)
  }

  if (typeof program === 'undefined') {
    process.exitCode = 1
    return
  }

  if (options.compileTo === 'ast') {
    console.log(JSON.stringify(program, undefined, 2))
    return
  }

  // the current compiler does not differentiate between chapters 1,2 or 3
  const compiled = compileToIns(program, options.sourceChapter)

  if (options.compileTo === 'debug') {
    console.log(stringifyProgram(compiled).trimRight())
    return
  } else if (options.compileTo === 'json') {
    console.log(JSON.stringify(compiled))
    return
  }

  const binary = assemble(compiled)

  switch (options.outputFilename) {
    case '-':
      process.stdout.write(binary)
      break
    case null:
      options.outputFilename = options.inputFilename.replace(/\.js$/i, '') + '.svm'
    default:
      return writeFileAsync(options.outputFilename, binary)
  }
}

main().catch(err => {
  console.error(err)
})
