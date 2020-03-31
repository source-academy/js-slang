import { BinaryOperator, UnaryOperator, LogicalOperator, Node } from 'estree'
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
  TranspilerThunk,
  makeThunkWithPrimitiveUnary,
  makeConditionalThunk,
  applyFunctionToThunks,
  InvalidNumberOfArgumentsInForce
} from '../transpiler/lazyTranspiler'
import { callExpression, locationDummyNode } from './astCreator'
import * as create from './astCreator'
import * as rttc from './rttc'

export function throwIfTimeout(start: number, current: number, line: number, column: number) {
  if (current - start > JSSLANG_PROPERTIES.maxExecTime) {
    throw new PotentialInfiniteLoopError(create.locationDummyNode(line, column))
  }
}

/**
 * Given a function and the correct arguments, checks if the
 * function is really a function and the arguments length is
 * correct, before returning a transpiler thunk that represents
 * the result of calling the function with those arguments.
 *
 * @param candidate The function to be tested.
 * @param line The line number of the expression.
 * @param column The column number of the expression.
 * @param args Array containing the arguments of the
 *             expressions (as thunks).
 */
export function callIfFuncAndRightArgs(
  candidate: any,
  line: number,
  column: number,
  ...args: TranspilerThunk<any>[]
) {
  const dummy = create.callExpression(
    create.locationDummyNode(line, column),
    args.map(thunk => create.literal(thunk.toString())),
    {
      start: { line, column },
      end: { line, column }
    }
  )
  if (typeof candidate === 'function') {
    // functions like force are not thunked and instead evaluated eagerly
    try {
      return candidate(...args)
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (error instanceof InvalidNumberOfArgumentsInForce) {
        throw new InvalidNumberOfArguments(dummy, error.expected, error.got)
      } else if (!(error instanceof RuntimeSourceError || error instanceof ExceptionError)) {
        throw new ExceptionError(error, dummy.loc!)
      } else {
        throw error
      }
    }
  } else if (rttc.isFunctionT(candidate)) {
    return applyFunctionToThunks(candidate, args, dummy, candidate.toString())
  } else {
    throw new CallingNonFunctionValue(candidate, dummy)
  }
}

/**
 * Same function as in operators.ts, this function
 * checks if the candidate is a boolean. If it is, then
 * return that boolean, if not throw an error. This function
 * is applied for all conditional statements, so calling
 * if/else or conditional statements with expressions that
 * evaluate not to booleans at runtime will be unsuccessful.
 *
 * @param candidate The candidate to be checked.
 * @param line The line number of the expression.
 * @param column The column number of the expression.
 *
 * @returns The boolean candidate. If candidate is not
 *          a boolean, throw an error.
 */
export function boolOrErr(candidate: any, line: number, column: number) {
  const error = rttc.checkIfStatement(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

/**
 * Given an expression (possibly a thunked one), check if the
 * expression is marked as type 'boolean'. If it does, or if
 * the type is not determinable at transpile time, return the
 * expression itself
 *
 * @param candidate The expression to be checked.
 * @param line The line number of the expression.
 * @param column The column number of the expression.
 *
 * @returns The thunk if the type is determinable and
 *          confirmed to be boolean. If the type is not
 *          determinable, just return the thunk also as it
 *          might still evaluate to boolean. For all other
 *          cases, throw an error.
 */
export function throwErrorIfNotBoolThunk(
  candidate: TranspilerThunk<any>,
  line: number,
  column: number
) {
  const error = rttc.checkIfStatementT(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate
  } else {
    throw error
  }
}

/**
 * Given an expression (possibly a thunked one), check if the
 * expression is marked as type 'boolean'. If it does, or if
 * the type is not determinable at transpile time, return the
 * type of the expression as a String (e.g. "boolean").
 *
 * @param candidate The expression to be checked.
 * @param line The line number of the expression.
 * @param column The column number of the expression.
 *
 * @returns The String type of the candidate, if it
 *          is determinable and "boolean", or if it is
 *          not determinable. Otherwise, throw an error.
 */
export function getTypeOfBoolThunkOrError(
  candidate: TranspilerThunk<any>,
  line: number,
  column: number
) {
  const error = rttc.checkIfStatementT(create.locationDummyNode(line, column), candidate)
  if (error === undefined) {
    return candidate.toString()
  } else {
    return error
  }
}

/**
 * Does a shallow checking of the type before the
 * program is transpiled.
 */
export function unaryOp(
  operator: UnaryOperator,
  argument: TranspilerThunk<any>,
  line: number,
  column: number
) {
  const locationNode = create.locationDummyNode(line, column)
  const resultType = rttc.checkUnaryExpressionT(locationNode, operator, argument)
  if (typeof resultType === 'string') {
    return evaluateUnaryExpression(operator, argument, resultType, locationNode)
  } else {
    throw resultType
  }
}

/**
 * Delays evaluation of an unary expression
 * in Lazy Source, returning a Thunk. Node with line
 * and column number are required to throw correct
 * errors in the event that thunks evaluate to
 * incorrect types.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param value The argument of this operator.
 * @param returnType The return type of the evaluated
 *     expression.
 * @param node Node representing location of the expression.
 */
export function evaluateUnaryExpression(
  operator: UnaryOperator,
  value: TranspilerThunk<any>,
  returnType: string,
  node: Node
) {
  if (operator === '!') {
    return makeThunkWithPrimitiveUnary(value, x => !x, returnType, operator, node)
  } else if (operator === '-') {
    return makeThunkWithPrimitiveUnary(value, x => -x, returnType, operator, node)
  } else if (operator === '+') {
    return makeThunkWithPrimitiveUnary(value, x => +x, returnType, operator, node)
  } else {
    return makeThunk(undefined)
  }
}

/**
 * Does a shallow checking of the type before the
 * program is transpiled.
 */
export function binaryOp(
  operator: BinaryOperator,
  left: TranspilerThunk<any>,
  right: TranspilerThunk<any>,
  line: number,
  column: number
) {
  const locationNode = create.locationDummyNode(line, column)
  const resultType = rttc.checkBinaryExpressionT(locationNode, operator, left, right)
  if (typeof resultType === 'string') {
    return evaluateBinaryExpression(operator, left, right, resultType, locationNode)
  } else {
    throw resultType
  }
}

/**
 * Delays evaluation of a binary expression in
 * Lazy Source, returning a Thunk. Line and
 * column number are required to throw correct
 * errors in the event that thunks evaluate to
 * incorrect types.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param left The first argument, or the left, of
 *     this operator.
 * @param right The second argument, or the right, of
 *     this operator.
 * @param returnType The return type of the evaluated
 *     expression.
 * @param node Node representing location of the expression.
 */
export function evaluateBinaryExpression(
  operator: BinaryOperator,
  left: TranspilerThunk<any>,
  right: TranspilerThunk<any>,
  returnType: string,
  node: Node
): TranspilerThunk<any> {
  switch (operator) {
    case '+':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x + y, returnType, operator, node)
    case '-':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x - y, returnType, operator, node)
    case '*':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x * y, returnType, operator, node)
    case '/':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x / y, returnType, operator, node)
    case '%':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x % y, returnType, operator, node)
    case '===':
      return makeThunkWithPrimitiveBinary(
        left,
        right,
        (x, y) => x === y,
        returnType,
        operator,
        node
      )
    case '!==':
      return makeThunkWithPrimitiveBinary(
        left,
        right,
        (x, y) => x !== y,
        returnType,
        operator,
        node
      )
    case '<=':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x <= y, returnType, operator, node)
    case '<':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x < y, returnType, operator, node)
    case '>':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x > y, returnType, operator, node)
    case '>=':
      return makeThunkWithPrimitiveBinary(left, right, (x, y) => x >= y, returnType, operator, node)
    default:
      return makeThunk(undefined)
  }
}

/**
 * This function will be called in place of logical
 * operations like && (and) or || (or), in order to
 * check whether the Thunks on left and right are of
 * type boolean, and to execute it lazily. Line
 * and column number are required to throw correct
 * errors in the event that thunks evaluate to
 * incorrect types.
 *
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
  left: TranspilerThunk<any>,
  right: TranspilerThunk<any>,
  line: number,
  column: number
) {
  const leftType = getTypeOfBoolThunkOrError(left, line, column)
  const rightType = getTypeOfBoolThunkOrError(right, line, column)
  if (typeof leftType === 'string' && typeof rightType === 'string') {
    return evaluateLogicalExpression(operator, left, right, line, column)
  } else if (typeof leftType === 'string') {
    throw rightType
  } else {
    throw leftType
  }
}

/**
 * Delays evaluation of a logical expression && (and)
 * and || (or) in Lazy Source, returning a Thunk. Line
 * and column number are required to throw correct
 * errors in the event that thunks evaluate to
 * incorrect types.
 *
 * @param operator String representing the operator
 *     to be executed.
 * @param left The first argument, or the left, of
 *     this operator.
 * @param right The second argument, or the right, of
 *     this operator.
 * @param line Line number of the expression in
 *     the program
 * @param column Column number of the expression
 *     in the program
 */
export function evaluateLogicalExpression(
  operator: LogicalOperator,
  left: TranspilerThunk<any>,
  right: TranspilerThunk<any>,
  line: number,
  column: number
): TranspilerThunk<any> {
  // string representation of resultant thunk
  const stringRep = left.toString() + ' ' + operator + ' ' + right.toString()
  switch (operator) {
    case '&&':
      return makeConditionalThunk(left, right, makeThunk(false), line, column, stringRep)
    case '||':
      return makeConditionalThunk(left, makeThunk(true), right, line, column, stringRep)
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
  predicate: TranspilerThunk<any>,
  consequent: TranspilerThunk<any>,
  alternate: TranspilerThunk<any>,
  line: number,
  column: number
): TranspilerThunk<any> {
  const predicateType = getTypeOfBoolThunkOrError(predicate, line, column)
  if (typeof predicateType === 'string') {
    return makeConditionalThunk(predicate, consequent, alternate, line, column)
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
