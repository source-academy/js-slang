// import { typeCheck } from '../typeChecker'
import { createContext } from '../index'
import { parse } from '../parser'
import { typeCheck } from '../typeChecker'

describe('binary expressions', () => {
  it('errors when adding number to string', () => {
    const context = createContext(1)
    const code = "const x = 5; const y = 'bob'; const z = x + y;"
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('no errors when adding number to number', () => {
    const context = createContext(1)
    const code = 'const x = 5; const y = 6; const z = x + y;'
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it('no errors when comparing number with number', () => {
    const context = createContext(1)
    const code = 'const x = 5; const y = 6; const z = x === y;'
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it('no errors when we have bool AND bool', () => {
    const context = createContext(1)
    const code = 'function x(a) { a && a; }'
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it('errors when we have bool AND number', () => {
    const context = createContext(1)
    const code = 'function x(a) { a && (a + 2); }'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('no errors when we have NOT bool', () => {
    const context = createContext(1)
    const code = 'const a = false; !a;'
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it('errors when we have NOT string', () => {
    const context = createContext(1)
    const code = 'const a = "b"; !a;'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('errors when we param used as bool and num in if else', () => {
    const context = createContext(1)
    const code = 'function x(a) { if (true) {a && a;} else { a + 2; } }'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('errors when having a string arg for function expecting a number', () => {
    const context = createContext(1)
    const code = 'function f(x) { return x + 2; } f("test");'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('errors when having a function called with wrong number of args', () => {
    const context = createContext(1)
    const code = 'function f(x) { return x; } f("test", 1);'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it('errors when using a variable recursively wrongly', () => {
    const context = createContext(1)
    const code = 'const f = (x) => { return f + 1; };'
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  it.skip('Allows for variables declared later, as long as function not called yet', () => {
    const context = createContext(1)
    const code = 'const a = () => {return x + 1;}; const x = 3;'
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it.skip('Type checks variables declared later', () => {
    const context = createContext(1)
    const code = "const a = () => {return x + 1;}; const x = 'b';"
    const program = parse(code, context)
    expect(() => typeCheck(program)).toThrowError()
  })

  // NOTE currently fails, can fix once we introduce polymorphic types
  it.skip('no errors when comparing string with string', () => {
    const context = createContext(1)
    const code = "const x = 'test'; const y = 'foo'; const z = x === y;"
    const program = parse(code, context)
    expect(() => typeCheck(program)).not.toThrowError()
  })
})
