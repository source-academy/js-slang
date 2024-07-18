import { Call_cc, Continuation, isCallWithCurrentContinuation } from '../continuations'
import { Control, Stash } from '../interpreter'

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
  const cont = new Continuation(new Control(), new Stash(), [])
  expect(cont.toString()).toBe('continuation')
})
