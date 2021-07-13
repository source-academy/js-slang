import { ExceptionError } from '../../errors/errors'
import { RuntimeSourceError } from '../../errors/runtimeSourceError'
import { TimeoutError } from '../../errors/timeoutErrors'
import { isPotentialInfiniteLoop, StackOverflowMessages } from '../errorMessages'

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
  const fakePos = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
  const exceptionError = new ExceptionError(new Error('Unexpected'), fakePos)
  expect(isPotentialInfiniteLoop(runtimeError)).toBe(false)
  expect(isPotentialInfiniteLoop(exceptionError)).toBe(false)
})
