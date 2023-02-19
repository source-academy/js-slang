import * as fs from 'fs'
import * as util from 'util'

import { createEmptyContext } from '../createContext'
import { parse } from '../parser/parser'
import { INTERNAL_FUNCTIONS as concurrentInternalFunctions } from '../stdlib/vm.prelude'
import { Chapter, Variant } from '../types'
import { assemble } from './svml-assembler'
import { compileToIns } from './svml-compiler'
import { stringifyProgram } from './util'

interface CliOptions {
  compileTo: 'debug' | 'json' | 'binary' | 'ast'
  sourceChapter: Chapter.SOURCE_1 | Chapter.SOURCE_2 | Chapter.SOURCE_3
  sourceVariant: Variant.DEFAULT | Variant.CONCURRENT // does not support other variants
  inputFilename: string
  outputFilename: string | null
  vmInternalFunctions: string[] | null
}

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

// This is a console program. We're going to print.
/* tslint:disable:no-console */

function parseOptions(): CliOptions | null {
  const ret: CliOptions = {
    compileTo: 'binary',
    sourceChapter: Chapter.SOURCE_3,
    sourceVariant: Variant.DEFAULT,
    inputFilename: '',
    outputFilename: null,
    vmInternalFunctions: null
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
          const argInt = parseInt(argument, 10)
          if (argInt === 1 || argInt === 2 || argInt === 3) {
            ret.sourceChapter = argInt
          } else {
            console.error('Invalid Source chapter: %d', argInt)
            error = true
          }
          args.splice(0, argShiftNumber)
          break
        case '--variant':
        case '-v':
          switch (argument) {
            case Variant.DEFAULT:
            case Variant.CONCURRENT:
              ret.sourceVariant = argument
              break
            default:
              console.error('Invalid/Unsupported Source Variant: %s', argument)
              error = true
              break
          }
          args.splice(0, argShiftNumber)
          break
        case '--out':
        case '-o':
          ret.outputFilename = argument
          args.splice(0, argShiftNumber)
          break
        case '--internals':
        case '-i':
          ret.vmInternalFunctions = JSON.parse(argument)
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
  1, 2, 3. Sets the Source chapter.
-v, --variant <variant>: [default]
  default: Normal Source
  concurrent: Concurrent Source (Assumes and overwrites chosen chapter with 3)
-o, --out <filename>: [see below]
  Sets the output filename.
  Defaults to the input filename, minus any '.js' extension, plus '.svm'.
-i, --internals <JSON array of internal names>: ["[]"]
  Sets the list of VM-internal functions. The argument should be a JSON array of
  strings containing the names of the VM-internal functions.
--:
  Signifies the end of arguments, in case your input filename starts with -.`)
    process.exitCode = 1
    return
  }

  const source = await readFileAsync(options.inputFilename, 'utf8')
  const context = createEmptyContext(options.sourceChapter, options.sourceVariant, [], null)
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

  if (program === null) {
    process.exitCode = 1
    return
  }

  if (options.compileTo === 'ast') {
    console.log(JSON.stringify(program, undefined, 2))
    return
  }

  if (options.sourceVariant === Variant.CONCURRENT && options.vmInternalFunctions) {
    console.warn('Warning: ignoring internal functions specified on command line for concurrent VM')
  }

  const vmInternalFunctions =
    options.sourceVariant === Variant.CONCURRENT
      ? concurrentInternalFunctions.map(([name]) => name)
      : options.vmInternalFunctions || []

  // the current compiler does not differentiate between chapters 1, 2 or 3
  const compiled = compileToIns(program, undefined, vmInternalFunctions)

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
