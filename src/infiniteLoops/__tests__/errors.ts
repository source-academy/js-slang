import { ExceptionError } from '../../errors/errors'
import { RuntimeSourceError } from '../../errors/runtimeSourceError'
import { TimeoutError } from '../../errors/timeoutErrors'
import {
  getInfiniteLoopData,
  InfiniteLoopError,
  InfiniteLoopErrorType,
  isPotentialInfiniteLoop,
  StackOverflowMessages
} from '../errors'

const noBaseCaseError = new InfiniteLoopError('f', false, 'test', InfiniteLoopErrorType.NoBaseCase)
const fakePos = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }

test('timeout errors are potential infinite loops', () => {
  const error = new TimeoutError()
  expect(isPotentialInfiniteLoop(error)).toBe(true)
})

test('stack overflows are potential infinite loops', () => {
  const fakePos = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
  const makeErrorWithString = (str: string) => new ExceptionError(new Error(str), fakePos)
  for (const message of Object.values(StackOverflowMessages)) {
    const error = makeErrorWithString(message)
    expect(isPotentialInfiniteLoop(error)).toBe(true)
  }
})

test('other errors are not potential infinite loops', () => {
  const runtimeError = new RuntimeSourceError()
  const exceptionError = new ExceptionError(new Error('Unexpected'), fakePos)
  expect(isPotentialInfiniteLoop(runtimeError)).toBe(false)
  expect(isPotentialInfiniteLoop(exceptionError)).toBe(false)
})

test('getInfiniteLoopData works when error is directly reported', () => {
  const result = getInfiniteLoopData([noBaseCaseError])
  expect(result).toBeDefined()
  expect(result?.[0]).toBe(InfiniteLoopErrorType.NoBaseCase)
})

test('getInfiniteLoopData works when error hidden in timeout', () => {
  const error: any = new TimeoutError()
  error.infiniteLoopError = noBaseCaseError
  const result = getInfiniteLoopData([error])
  expect(result).toBeDefined()
  expect(result?.[0]).toBe(InfiniteLoopErrorType.NoBaseCase)
})

test('getInfiniteLoopData works when error hidden in exceptionError', () => {
  const innerError: any = new Error()
  innerError.infiniteLoopError = noBaseCaseError
  const result = getInfiniteLoopData([new ExceptionError(innerError, fakePos)])
  expect(result).toBeDefined()
  expect(result?.[0]).toBe(InfiniteLoopErrorType.NoBaseCase)
})
