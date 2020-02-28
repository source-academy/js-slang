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
    typeCheck(program)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  it('no errors when comparing number with number', () => {
    const context = createContext(1)
    const code = 'const x = 5; const y = 6; const z = x === y;'
    const program = parse(code, context)
    typeCheck(program)
    expect(() => typeCheck(program)).not.toThrowError()
  })

  // NOTE currently fails, can fix once we introduce polymorphic types
  // it('no errors when comparing string with string', () => {
  //     const context = createContext(1)
  //     const code = "const x = 'test'; const y = 'foo'; const z = x === y;"
  //     const program = parse(code, context);
  //     typeCheck(program);
  //     expect(() => typeCheck(program)).not.toThrowError()
  // })
})
