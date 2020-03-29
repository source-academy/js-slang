/* tslint:disable:object-literal-key-quotes no-string-literal */
import { createContext } from '../index'
import { parse as __parse } from '../parser/parser'
import { typeCheck } from '../typeChecker'

// simple program to parse program and error if there are syntatical errors
function parse(code: any, chapter = 1) {
  const program: any = __parse(code, createContext(chapter))
  expect(program).not.toBeUndefined()
  return program
}

describe('type checking pairs and lists', () => {
  it('happy paths for pair functions', () => {
    const code = `
      const x = pair(3, 4);
      head(x) + 56;
    `
    expect(() => typeCheck(parse(code))).not.toThrowError()
  })

  it('unhappy paths for pair functions', () => {
    const code = `
      const x = pair(3, 4);
      const y = x + false;
    `
    expect(() => typeCheck(parse(code, 2))).toThrowError()

    // const code1 = `
    //   const x = pair(3, pair(4, false));
    //   const y = tail(tail(x)) + 1;
    // `
    // expect(() => typeCheck(parse(code1, 2))).toThrowError()
  })
})

describe('type checking for polymorphic builtin functions', () => {
  it('works in happy case', () => {
    const code = `
      const x = is_boolean('file') || false;
    `
    typeCheck(parse(code))
  })

  it('errors in unhappy path', () => {
    const code = `
      const x = is_boolean(5) + 5;
    `
    const program = parse(code)
    expect(() => typeCheck(program)).toThrowError()
  })
})

describe('type checking overloaded unary/binary primitives', () => {
  it('works for the happy path', () => {
    const code = `
      function foo(x) {return x + 1;}
      function bar(x, y) {return x + y;}
      const a = 5;
      const b = 3;
      const c = foo(a) + bar(1, b);
      3 + 4;
    `
    typeCheck(parse(code))
    const code1 = `
      function rec(x) {
          return x === 1 ? x : rec(x-1);
      }
      rec(5);
    `
    typeCheck(parse(code1))
    const code2 = `
      const x = !false;
      const y = x || true;
    `
    typeCheck(parse(code2))
  })

  it('errors for unhappy path', () => {
    const code = '4 + false;'
    expect(() => typeCheck(parse(code))).toThrowError()
    const code1 = '{const a = 4; const b = false; a + b;}'
    expect(() => typeCheck(parse(code1))).toThrowError()
    const code2 = `
    {
      function foo(x) {return x +1;}
      const y = foo(false);
    }
    `
    expect(() => typeCheck(parse(code2))).toThrowError()
    const code3 = `{
      function foo(x) {return x + 1}
      function bar(x, y) {return x + y;}
      const a = 5;
      const b = 3;
      const c = foo(a) + bar(1, false);
    }`
    expect(() => typeCheck(parse(code3))).toThrowError()
    const code4 = `{
      function rec(x) {
          return x === 1 ? x : rec(x-1);
      }
      rec(false);
    }`
    expect(() => typeCheck(parse(code4))).toThrowError()
  })
})

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

// describe('type checking conditional expression and if statement', () => {
// happy paths
// it('does nothing now', () => {
//   expect(() => true).not.toThrowError()
// })
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
// })

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
