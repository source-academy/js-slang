import { Context, Value } from '../types'
import { compileToIns, Program as machineProgram } from '../vm/svml-compiler'
import { runWithP } from '../vm/svml-machine'
import { stringifyProgram } from '../vm/util'
import { ParseError } from './parser'
import { parse } from '../parser/parser'
import { validateAndAnnotate } from '../validator/validator'
import { Program } from 'estree'
import { vmPrelude, generatePrimitiveFunctionCode } from './vm.prelude'

export function parse_and_compile(x: string, context: Context, includePrelude: boolean): Value {
  let program
  let prelude: machineProgram | undefined

  if (includePrelude) {
    // wrap in a function
    // add prelude
    const preludeProg = parse(vmPrelude, context)
    if (preludeProg !== undefined) {
      prelude = compileToIns(preludeProg)
    } else {
      throw new ParseError('Unreachable')
    }

    const primitives = generatePrimitiveFunctionCode()
    primitives.forEach(func => {
      prelude![1][func[0] + 1] = func[1] // + 1 due to global env
    })
    // note: program needs to replace index 92 in compiler (GE + 90 primitives)
  }

  program = parse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }
  validateAndAnnotate(program as Program, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program !== undefined) {
    return compileToIns(program, prelude)
  } else {
    throw new ParseError('Unreachable')
  }
}

export function stringify_compiled(code: machineProgram) {
  return stringifyProgram(code)
}

export function run_vm(code: machineProgram): any {
  return runWithP(code)
}
