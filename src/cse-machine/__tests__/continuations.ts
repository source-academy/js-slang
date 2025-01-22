import { mockContext } from '../../mocks/context'
import { Call_cc, Continuation, isCallWithCurrentContinuation } from '../continuations'
import { Control, Stash, Transformers } from '../interpreter'

test('call/cc is a singleton', () => {
  expect(Call_cc.get()).toBe(Call_cc.get())
})

test('call/cc toString', () => {
  expect(Call_cc.get().toString()).toBe('call/cc')
})

test('isCallWithCurrentContinuation works on call/cc only', () => {
  expect(isCallWithCurrentContinuation(Call_cc.get())).toBe(true)
  expect(isCallWithCurrentContinuation(1)).toBe(false)
})

test('Continuation toString', () => {
  const cont = new Continuation(mockContext(), new Control(), new Stash(), [], new Transformers())
  expect(cont.toString()).toBe('continuation')
})
