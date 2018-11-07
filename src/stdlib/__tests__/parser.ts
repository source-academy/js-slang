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

test("Parses declaration statements", () => {
  const program = `
    stringify(parse("const x = 5; let y = x;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses assignment statements", () => {
  const program = `
    stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: "preemptive" })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test("Parses if statements", () => {
  const program = `
    stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);
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

test('Parses object notation', () => {
  const code = `
    stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses property access', () => {
  const code = `
    stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses property assignment', () => {
  const code = `
    stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses loops', () => {
  const code = `
    stringify(parse("while (true) { continue; break; } for (let i = 0; i < 1; i = i + 1) { continue; break; } for (i = 0; i < 1; i = i + 1) { continue; break; }"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Does not parse incomplete statements', () => {
  const code = `
    parse("5");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse if statements without else', () => {
  const code = `
    parse("if (true) {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse for loops with empty initialiser', () => {
  const code = `
    parse("for (; true; x = x+1) {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse for loops with multiple initialisers', () => {
  const code = `
    parse("for (let x = 0, y = 3; true; x = x+1) {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse for loops with empty predicate', () => {
  const code = `
    parse("for (x = 1; ; x = x+1) {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse for loops with empty finaliser', () => {
  const code = `
    parse("for (x = 1; true; ) {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse while loops with empty predicate', () => {
  const code = `
    parse("while () {}");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse function expressions', () => {
  const code = `
    parse("(function(x){return x+1})(4);");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse assignment expressions', () => {
  const code = `
    parse("x = y = z;");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse update expressions', () => {
  const code = `
    parse("x++;");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse update expressions', () => {
  const code = `
    parse("++x;");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('Does not parse update statements', () => {
  const code = `
    parse("x -= 5;");
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

