import { parse } from '../parser'
import { Context, Value } from '../types'
import { compileToIns, printProgram } from '../vm/compiler'
import { runWithP } from '../vm/machine'
import { ParseError } from './parser'

export function parse_and_compile(x: string, context: Context): Value {
  let program

  program = parse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program !== undefined) {
    return compileToIns(program, context)
  } else {
    throw new ParseError('Unreachable')
  }
}

export function print_compiled_program(code: number[]) {
  printProgram(code)
}

export function run_vm(code: number[]) {
  return runWithP(code)
}
