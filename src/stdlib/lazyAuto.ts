import * as interpreter from '../interpreter/lazyInterpreter'
import * as transpiler from '../transpiler/lazyTranspiler'
import * as intTypeCheck from './interpreterLazyTypeCheck'
import * as transTypeCheck from './transpilerLazyTypeCheck'
import * as intList from './interpreterLazyList'
import * as transList from './transpilerLazyList'
import { parse_int as originalParseInt } from './misc'

/**
 * Defines functions that will work for both transpiler
 * and interpreter thunks, in the event that the execution
 * method is 'auto' (not known yet at the time when the
 * context is created and built-ins defined)
 */

// tslint:disable: variable-name

// =============== LAZY EVALUATION FUNCTIONS ================
export const force = (...args: any[]) => switchBetween(args, transpiler.force, intTypeCheck.force)

export const force_once = (...args: any[]) =>
  switchBetween(args, transpiler.force_once, intTypeCheck.force_once)

export const force_pair = (...args: any[]) =>
  switchBetween(args, transpiler.force_pair, intTypeCheck.force_pair)

export const is_thunk = (...args: any[]) =>
  switchBetween(args, transpiler.is_thunk, intTypeCheck.is_thunk)

// ================== TYPE CHECK FUNCTIONS ==================

export const is_number = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_number, intTypeCheck.is_number)

export const is_string = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_string, intTypeCheck.is_string)

export const is_function = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_function, intTypeCheck.is_function)

export const is_boolean = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_boolean, intTypeCheck.is_boolean)

export const is_undefined = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_undefined, intTypeCheck.is_undefined)

// ===================== MISC FUNCTIONS =====================
export const parse_int = (...args: any[]) =>
  switchBetween(
    args,
    (str: any, radix: any) => originalParseInt(transpiler.force(str), transpiler.force(radix)),
    intTypeCheck.parse_int
  )

// ===================== LIST FUNCTIONS =====================
export const pair = (...args: any[]) => switchBetween(args, transList.pair, intList.pair)

export const is_pair = (...args: any[]) => switchBetween(args, transList.is_pair, intList.is_pair)

export const head = (...args: any[]) => switchBetween(args, transList.head, intList.head)

export const tail = (...args: any[]) => switchBetween(args, transList.tail, intList.tail)

export const is_null = (...args: any[]) =>
  switchBetween(args, transTypeCheck.is_null, intList.is_null)

export const list = (...args: any[]) => switchBetween(args, transList.list, intList.list)

/**
 * Given the (thunked) arguments of a function, as well as the
 * corresponding interpreter and transpiler functions, determines
 * which function should evaluate the arguments. Afterwards,
 * passes these arguments to that function and returns
 * the result from that function.
 *
 * @param args The arguments to be applied.
 * @param transpilerFunc The function to be used, if the thunked
 *                       arguments came from the transpiler.
 * @param interpreterFunc The function to be used, if the thunked
 *                        arguments came from the interpreter.
 */
export function switchBetween(
  args: any[],
  // tslint:disable-next-line: ban-types
  transpilerFunc: Function,
  // tslint:disable-next-line: ban-types
  interpreterFunc: Function,
  functionName: string = '<unknown>'
) {
  if (args.every(a => !interpreter.isInterpreterThunk(a))) {
    // since every argument is not an interpreter thunk, it
    // can be run with the transpiler functions
    return transpilerFunc(...args)
  } else if (args.every(a => !transpiler.isTranspilerThunk(a))) {
    // since every argument is not a transpiler thunk, it
    // can be run with the interpreter functions
    return interpreterFunc(...args)
  } else {
    throw new Error('Mixed transpiler and interpreter thunk types in function ' + functionName)
  }
}
