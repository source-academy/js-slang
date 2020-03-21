import { BinaryOperator, UnaryOperator, LogicalOperator } from 'estree'
import { JSSLANG_PROPERTIES } from '../constants'
import {
  CallingNonFunctionValue,
  ExceptionError,
  GetInheritedPropertyError,
  InvalidNumberOfArguments
} from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import {
  PotentialInfiniteLoopError,
  PotentialInfiniteRecursionError
} from '../errors/timeoutErrors'
import {
  makeThunk,
  makeThunkWithPrimitiveBinary,
  Thunk,
  makeThunkWithPrimitiveUnary,
  makeConditionalThunk
} from '../stdlib/lazy'
import { callExpression, locationDummyNode } from './astCreator'
import * as create from './astCreator'
import * as rttc from './rttc'

export function throwIfTimeout(start: number, current: number, line: number, column: number) {
  if (current - start > JSSLANG_PROPERTIES.maxExecTime) {
    throw new PotentialInfiniteLoopError(create.locationDummyNode(line, column))
  }
}

export function callIfFuncAndRightArgs(
  candidate: any,
  line: number,
  column: number,
  ...args: any[]
) {
  const dummy = create.callExpression(create.locationDummyNode(line, column), args, {
    start: { line, column },
    end: { line, column }
  })
  if (typeof candidate === 'function') {
    if (candidate.transformedFunction === undefined) {
      try {
        return candidate(...args)
      } catch (error) {
        // if we already handled the error, simply pass it on
        if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
          throw new ExceptionError(error, dummy.loc!)
        } else {
          throw error
        }
      }
    } else {
      const expectedLength = candidate.transformedFunction.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(dummy, expectedLength, receivedLength)
      }
      return candidate(...args)
    }
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

export function boolOrErr(candidate: Thunk<any>, line: number, column: number) {
  const error = rttc.checkIfStatementT(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate.toString()
  } else {
    return error
  }
}

export function unaryOp(
  operator: UnaryOperator,
  argument: Thunk<any>,
  line: number,
  column: number
) {
  const resultType = rttc.checkUnaryExpressionT(
    create.locationDummyNode(line, column),
    operator,
    argument
  )
  if (typeof resultType === 'string') {
    return evaluateUnaryExpression(operator, argument, resultType)
  } else {
    throw resultType
  }
}

/**
 * Delays evaluation of an unary expression
 * in Lazy Source, returning a Thunk.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param value The argument of this operator.
 * @param returnType The return type of the evaluated
 *     expression.
 */
export function evaluateUnaryExpression(
  operator: UnaryOperator,
  value: Thunk<any>,
  // default value '' to prevent problems with substitutor, intepreter
  returnType: string = ''
) {
  if (operator === '!') {
    return makeThunkWithPrimitiveUnary(value, x => !x, returnType, operator)
  } else if (operator === '-') {
    return makeThunkWithPrimitiveUnary(value, x => -x, returnType, operator)
  } else if (operator === '+') {
    return makeThunkWithPrimitiveUnary(value, x => +x, returnType, operator)
  } else {
    return makeThunk(undefined)
  }
}

export function binaryOp(
  operator: BinaryOperator,
  left: Thunk<any>,
  right: Thunk<any>,
  line: number,
  column: number
) {
  const resultType = rttc.checkBinaryExpressionT(
    create.locationDummyNode(line, column),
    operator,
    left,
    right
  )
  if (typeof resultType === 'string') {
    return evaluateBinaryExpression(operator, left, right, resultType)
  } else {
    throw resultType
  }
}

/**
 * Delays evaluation of a binary expression in
 * Lazy Source, returning a Thunk.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param left The first argument, or the left, of
 *     this operator.
 * @param right The second argument, or the right, of
 *     this operator.
 * @param returnType The return type of the evaluated
 *     expression.
 */
export function evaluateBinaryExpression(
  operator: BinaryOperator,
  left: Thunk<any>,
  right: Thunk<any>,
  // default value '' to prevent problems with substitutor, intepreter
  returnType: string = ''
): Thunk<any> {
  switch (operator) {
    case '+':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x + y, returnType, operator)
    case '-':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x - y, returnType, operator)
    case '*':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x * y, returnType, operator)
    case '/':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x / y, returnType, operator)
    case '%':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x % y, returnType, operator)
    case '===':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x === y, returnType, operator)
    case '!==':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x !== y, returnType, operator)
    case '<=':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x <= y, returnType, operator)
    case '<':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x < y, returnType, operator)
    case '>':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x > y, returnType, operator)
    case '>=':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x >= y, returnType, operator)
    default:
      return makeThunk(undefined)
  }
}

/**
 * This function will be called in place of logical
 * operations like && (and) or || (or), in order to
 * check whether the Thunks on left and right are of
 * type boolean, and to execute it lazily
 * @param operator String representing the operator
 *     to be executed.
 * @param left The (boolean) expression on the left
 *     of the operator (Thunk)
 * @param right The (boolean) expression on the right
 *     of the operator (Thunk)
 * @param line Line number of the expression in
 *     the program
 * @param column Column number of the expression
 *     in the program
 */
export function logicalOp(
  operator: LogicalOperator,
  left: Thunk<any>,
  right: Thunk<any>,
  line: number,
  column: number
) {
  const leftType = boolOrErr(left, line, column)
  const rightType = boolOrErr(right, line, column)
  if (typeof leftType === 'string' && typeof rightType === 'string') {
    return evaluateLogicalExpression(operator, left, right)
  } else if (typeof leftType === 'string') {
    throw rightType
  } else {
    throw leftType
  }
}

/**
 * Delays evaluation of a logical expression && (and)
 * and || (or) in Lazy Source, returning a Thunk.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param left The first argument, or the left, of
 *     this operator.
 * @param right The second argument, or the right, of
 *     this operator.
 */
export function evaluateLogicalExpression(
  operator: LogicalOperator,
  left: Thunk<any>,
  right: Thunk<any>
): Thunk<any> {
  // string representation of resultant thunk
  const stringRep = left.toString() + ' ' + operator + ' ' + right.toString()
  switch (operator) {
    case '&&':
      return makeConditionalThunk(left, right, makeThunk(false), stringRep)
    case '||':
      return makeConditionalThunk(left, makeThunk(true), right, stringRep)
    default:
      return makeThunk(undefined)
  }
}

/**
 * This function will be called in place of conditional
 * expressions, in order to check whether the predicate
 * thunk is of type boolean, and to execute it lazily
 * @param predicate Predicate expression to be evaluated.
 * @param consequent Consequent to be evaluated, if
 *     predicate evaluates to true.
 * @param alternate Alternate to be evaluated, if
 *     predicate evaluates to false.
 * @param line Line number of the expression in
 *     the program
 * @param column Column number of the expression
 *     in the program
 */
export function conditionalOp(
  predicate: Thunk<any>,
  consequent: Thunk<any>,
  alternate: Thunk<any>,
  line: number,
  column: number
): Thunk<any> {
  const predicateType = boolOrErr(predicate, line, column)
  if (typeof predicateType === 'string') {
    return makeConditionalThunk(predicate, consequent, alternate)
  } else {
    throw predicateType
  }
}

/**
 * Limitations for current properTailCalls implementation:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
 */
export const callIteratively = (f: any, ...args: any[]) => {
  let line = -1
  let column = -1
  const MAX_TIME = JSSLANG_PROPERTIES.maxExecTime
  const startTime = Date.now()
  const pastCalls: [string, any[]][] = []
  while (true) {
    const dummy = locationDummyNode(line, column)
    if (Date.now() - startTime > MAX_TIME) {
      throw new PotentialInfiniteRecursionError(dummy, pastCalls)
    } else if (typeof f !== 'function') {
      throw new CallingNonFunctionValue(f, dummy)
    }
    if (f.transformedFunction! !== undefined) {
      f = f.transformedFunction
      const expectedLength = f.length
      const receivedLength = args.length
      if (expectedLength !== receivedLength) {
        throw new InvalidNumberOfArguments(
          callExpression(locationDummyNode(line, column), args, {
            start: { line, column },
            end: { line, column }
          }),
          expectedLength,
          receivedLength
        )
      }
    }
    let res
    try {
      res = f(...args)
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc!)
      } else {
        throw error
      }
    }
    if (res === null || res === undefined) {
      return res
    } else if (res.isTail === true) {
      f = res.function
      args = res.arguments
      line = res.line
      column = res.column
      pastCalls.push([res.functionName, args])
    } else if (res.isTail === false) {
      return res.value
    } else {
      return res
    }
  }
}

export const wrap = (f: (...args: any[]) => any, stringified: string) => {
  const wrapped = (...args: any[]) => callIteratively(f, ...args)
  wrapped.transformedFunction = f
  wrapped[Symbol.toStringTag] = () => stringified
  wrapped.toString = () => stringified
  return wrapped
}

export const setProp = (obj: any, prop: any, value: any, line: number, column: number) => {
  const dummy = locationDummyNode(line, column)
  const error = rttc.checkMemberAccess(dummy, obj, prop)
  if (error === undefined) {
    return (obj[prop] = value)
  } else {
    throw error
  }
}

export const getProp = (obj: any, prop: any, line: number, column: number) => {
  const dummy = locationDummyNode(line, column)
  const error = rttc.checkMemberAccess(dummy, obj, prop)
  if (error === undefined) {
    if (obj[prop] !== undefined && !obj.hasOwnProperty(prop)) {
      throw new GetInheritedPropertyError(dummy, obj, prop)
    } else {
      return obj[prop]
    }
  } else {
    throw error
  }
}
