import { Context, Value } from '../types'
import { runWithP } from '../vm/machine'
import { compileToIns, Program } from '../vm/svml-compiler'
import { stringifyProgram } from '../vm/util'
import { ParseError } from './parser'
import { parse } from '../parser/parser'

export function parse_and_compile(x: string, context: Context): Value {
  let program

  program = parse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program !== undefined) {
    return compileToIns(program)
  } else {
    throw new ParseError('Unreachable')
  }
}

export function stringify_compiled(code: Program) {
  return stringifyProgram(code)
}

export function run_vm(code: number[]): any {
  return runWithP(code)
}
