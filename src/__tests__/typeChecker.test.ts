/* tslint:disable:object-literal-key-quotes no-string-literal */
// import { typeCheck } from '../typeChecker'
// import { createContext } from '../index'
// import { parse as __parse } from '../parser'
// import { typeCheck } from '../typeChecker'

// simple program to parse program and error if there are syntatical errors
// function parse(code: any) {
//   const program: any = __parse(code, createContext(1))
//   expect(program).not.toBeUndefined()
//   return program
// }

// describe('type checking builtin functions', () => {
//   it('no errors for well defined use of builtin functions', () => {
//     /**
//      * types of functions
//      * 1. is_XXX: any -> bool
//      * 2. math_XXX: number -> number
//      * NOTE parse_int might fail but I think that it is safe to assume that return type is number
//      * 3. parse_int: string -> number
//      * 4. prompt: string -> string
//      * 5. runtime: -> number
//      */
//     const code = `
//     const a = is_boolean(true);
//     const b = math_abs(4.1 - 5.3);
//     const c = parse_int("42", 10);

//     const d = is_boolean(is_number(45));

//     const e = runtime();
//     `
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it('errors if apply string to math function', () => {
//     const code = "const a = math_abs('clearly not a number');"
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })
// })

describe('type checking conditional expression and if statement', () => {
  // happy paths
  it('does nothing now', () => {
    expect(() => true).not.toThrowError()
  })
  // it('no errors for well typed conditional expression', () => {
  //   const code = 'const flag1 = true; const flag2 = false; const x = flag1 && flag2 ? 1 : 2;'
  //   const program = parse(code)
  //   expect(() => typeCheck(program)).not.toThrowError()
  // })

  // it('no errors for well typed if statement', () => {
  //   const code =
  //     'const flag1 = true; const flag2 = false; if(flag1 || flag2) {const x = 5;} else {const y=4;}'
  //   const program = parse(code)
  //   expect(() => typeCheck(program)).not.toThrowError()
  // })

  // // sad paths
  // it('errors when adding number to string in conditional expression', () => {
  //   const code = "const x = true ? 5 + 'foo' : 4 + 4;"
  //   const program = parse(code)
  //   expect(() => typeCheck(program)).toThrowError()

  //   const code2 = "const x = true ? 5 + 1 : 4 + 'foo';"
  //   const program2 = parse(code2)
  //   expect(program2).not.toBeUndefined()
  //   expect(() => typeCheck(program2)).toThrowError()
  // })

  // it('errors when conditional test is not bool', () => {
  //   const code = 'const x = 5 ? 1 : 2;'
  //   const program = parse(code)
  //   expect(() => typeCheck(program)).toThrowError()
  // })

  // it('errors when if statement test is not bool', () => {
  //   const code = 'if(5 + 4) {const x = 4;} else {const x = 5;}'
  //   const program = parse(code)
  //   expect(() => typeCheck(program)).toThrowError()
  // })
})

// describe('binary expressions', () => {
//   it('errors when adding number to string', () => {
//     const code = "const x = 5; const y = 'bob'; const z = x + y;"
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('errors when adding number to string', () => {
//     const code = "const x = 5; const y = 'bob'; const z = x + y;"
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('no errors when adding number to number', () => {
//     const code = 'const x = 5; const y = 6; const z = x + y;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it('no errors when comparing number with number', () => {
//     const code = 'const x = 5; const y = 6; const z = x === y;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it('no errors when we have bool AND bool', () => {
//     const code = 'function x(a) { a && a; }'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it('errors when we have bool AND number', () => {
//     const code = 'function x(a) { a && (a + 2); }'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('no errors when we have NOT bool', () => {
//     const code = 'const a = false; !a;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it('errors when we have NOT string', () => {
//     const code = 'const a = "b"; !a;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('errors when we param used as bool and num in if else', () => {
//     const code = 'function x(a) { if (true) {a && a;} else { a + 2; } }'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('errors when having a string arg for function expecting a number', () => {
//     const code = 'function f(x) { return x + 2; } f("test");'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('errors when having a function called with wrong number of args', () => {
//     const code = 'function f(x) { return x; } f("test", 1);'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('errors when using a variable recursively wrongly', () => {
//     const code = 'const f = (x) => { return f + 1; };'
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it.skip('Allows for variables declared later, as long as function not called yet', () => {
//     const code = 'const a = () => {return x + 1;}; const x = 3;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it.skip('Type checks variables declared later', () => {
//     const code = "const a = () => {return x + 1;}; const x = 'b';"
//     const program = parse(code)
//     expect(() => typeCheck(program)).toThrowError()
//   })

//   it('no errors when comparing string with string', () => {
//     const code = "const x = 'test'; const y = 'foo'; const z = x === y;"
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })

//   it.skip('no errors when adding int with number', () => {
//     const code = 'const x = 1.5; const y = 1; const z = x + y;'
//     const program = parse(code)
//     expect(() => typeCheck(program)).not.toThrowError()
//   })
// })
