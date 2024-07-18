import { Call_cc } from '../continuations'

test('Call/cc is a singleton', () => {
  expect(Call_cc.get()).toBe(Call_cc.get())
})
