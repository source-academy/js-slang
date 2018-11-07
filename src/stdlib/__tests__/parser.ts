import { mockContext } from "../../mocks/context"
import { runInContext } from "../../index"

test("Parses empty program", () => {
  const program = `
    stringify(parse(""), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses literals", () => {
  const program = `
    stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses name expression", () => {
  const program = `
    stringify(parse("x;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses name expressions", () => {
  const program = `
    stringify(parse("x; moreNames; undefined; this;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses infix expressions", () => {
  const program = `
    stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function expressions properly', () => {
  const code = `
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function expressions properly', () => {
  const code = `
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function assignments properly', () => {
  const code = `
    stringify(parse("const y = (x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses arrow function expressions properly', () => {
  const code = `
    stringify(parse("x => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses arrow function assignments properly', () => {
  const code = `
    stringify(parse("const y = x => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

