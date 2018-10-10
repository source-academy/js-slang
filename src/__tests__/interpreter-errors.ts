import { mockContext } from "../mocks/context";
import { runInContext, parseError } from "../index";

test("Undefined variable error is thrown", () => {
  const code = `
    im_undefined;
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe("error")
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe("Line 2: Name im_undefined not declared")
  })
})


test("Compound assignment not allowed", () => {
  const code = `
    let x = 1;
	x += 1;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe("error")
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe("Line 3: Compound assignment '+=' not allowed")
  })
})
