import { Context, Value } from '../types'
import { compileToIns, Program as machineProgram, compileWithPrelude } from '../vm/svml-compiler'
import { runWithP } from '../vm/svml-machine'
import { stringifyProgram } from '../vm/util'
import { ParseError } from './parser'
import { parse } from '../parser/parser'
import { validateAndAnnotate } from '../validator/validator'
import { Program } from 'estree'

export function parse_and_compile(x: string, context: Context, includePrelude: boolean): Value {
  const program = parse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }
  validateAndAnnotate(program as Program, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program !== undefined) {
    return includePrelude ? compileWithPrelude(program, context) : compileToIns(program)
  } else {
    throw new ParseError('Unreachable')
  }
}

export function stringify_compiled(code: machineProgram) {
  return stringifyProgram(code)
}

export function run_vm(code: machineProgram, context: Context): any {
  return runWithP(code, context)
}
