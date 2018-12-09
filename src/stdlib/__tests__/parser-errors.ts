import { mockContext } from "../../mocks/context"
import { parseError, runInContext } from "../../index"

test("Blatant syntax error", () => {
  const program = `
    stringify(parse("'"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test("Blacklisted syntax", () => {
  const program = `
    stringify(parse("function* f() { yield 1; } f();"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test("Syntax rules", () => {
  const program = `
    stringify(parse("x = y = x;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})
