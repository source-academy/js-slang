import {
  infiniteLoopErrorType,
  InfiniteLoopErrorMessage,
  StackOverflowMessages
} from '../errorMessages'

test('recognises infinite loop detector errors', () => {
  for (const [type, message] of Object.entries(InfiniteLoopErrorMessage)) {
    expect(infiniteLoopErrorType(message)).toEqual(type)
  }
})

test('recognises browser stack overflows', () => {
  for (const message of Object.values(StackOverflowMessages)) {
    expect(infiniteLoopErrorType(message)).toEqual('stack_overflow')
  }
})
