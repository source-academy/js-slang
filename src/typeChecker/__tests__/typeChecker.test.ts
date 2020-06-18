/* tslint:disable:object-literal-key-quotes no-string-literal */
import { parse as __parse } from '../../parser/parser'
import { typeCheck } from '../typeChecker'
import { mockContext } from '../../mocks/context'
import { validateAndAnnotate } from '../../validator/validator'
import { TypeAnnotatedNode, TypeAnnotatedFuncDecl } from '../../types'
import { typeToString } from '../../utils/stringify'
import { parseError } from '../../index'
import * as es from 'estree'

// simple program to parse program and error if there are syntatical errors
function parse(code: any, chapter = 1) {
  const context = mockContext(chapter)
  const program: any = __parse(code, context)
  expect(program).not.toBeUndefined()
  return validateAndAnnotate(program, context)
}

function topLevelTypesToString(program: TypeAnnotatedNode<es.Program>) {
  return program.body
    .filter(node => ['VariableDeclaration', 'FunctionDeclaration'].includes(node.type))
    .map(
      (
        node: TypeAnnotatedNode<es.VariableDeclaration> | TypeAnnotatedNode<es.FunctionDeclaration>
      ) => {
        const id =
          node.type === 'VariableDeclaration'
            ? (node.declarations[0].id as es.Identifier).name
            : node.id?.name!
        const actualNode =
          node.type === 'VariableDeclaration'
            ? (node.declarations[0].init! as TypeAnnotatedNode<es.Node>)
            : node
        const type =
          actualNode.typability === 'Untypable'
            ? "Couldn't infer type"
            : typeToString(
                actualNode.type === 'FunctionDeclaration'
                  ? (actualNode as TypeAnnotatedFuncDecl).functionInferredType!
                  : actualNode.inferredType!
              )
        return `${id}: ${type}`
      }
    )
    .join('\n')
}

describe('type checking pairs and lists', () => {
  it('happy paths for list functions', () => {
    const code1 = `
      function accumulate(op, init, xs) {
        return is_null(xs) ? init : op(head(xs), accumulate(op, init, tail(xs)));
      }
      function map(f, xs) {
        return is_null(xs) ? null : pair(f(head(xs)), map(f, tail(xs)));
      }
      function append(xs, ys) {
        return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
      }
      function remove(v, xs) {
        return is_null(xs) ? null : v === head(xs) ? tail(xs) : pair(head(xs), remove(v, tail(xs)));
      }
      const xs = pair(1, pair(2, null));
      const y = accumulate((x,y)=>x+y,0,xs);
      const xs1 = map(x => x<4 ? true : false, xs);
      const xs2 = map(x => x>4 ? true : false, xs);
      const xs3 = append(xs1, xs2);
    `
    const [program, errors] = typeCheck(parse(code1, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "accumulate: ((number, number) -> number, number, List<number>) -> number
      map: (number -> boolean, List<number>) -> List<boolean>
      append: (List<boolean>, List<boolean>) -> List<boolean>
      remove: (addable, List<addable>) -> List<addable>
      xs: List<number>
      y: number
      xs1: List<boolean>
      xs2: List<boolean>
      xs3: List<boolean>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('works for accumulate used with different kinds of pairs', () => {
    const code = `
      function accumulate(op, init, xs) {
        return is_null(xs) ? init : op(head(xs), accumulate(op, init, tail(xs)));
      }
      const xs = pair(1, pair(2, null));
      const ys = pair(true, pair(true, null));
      accumulate((x,y)=>x+y,0,xs);
      accumulate((x,y)=>x||y,0,ys);
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "accumulate: ((T0, T1) -> T1, T1, List<T0>) -> T1
      xs: List<number>
      ys: List<boolean>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('Will not work if used in a monomorphic manner', () => {
    const code = `
      function accumulate(op, init, xs) {
        return is_null(xs) ? init : op(head(xs), accumulate(op, init, tail(xs)));
      }
      const xs = pair(1, pair(2, null));
      const ys = pair(true, pair(true, null));
      const a = accumulate((x,y)=>x+y,0,xs);
      const b = accumulate((x,y)=>x||y,0,ys);
    `

    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "accumulate: ((number, number) -> number, number, List<number>) -> number
      xs: List<number>
      ys: List<boolean>
      a: number
      b: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 8: A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, 0, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, T0) -> T0, number, List<boolean>"
    `)
    expect(parseError(errors, true)).toMatchInlineSnapshot(`
      "Line 8, Column 16: A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, 0, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, T0) -> T0, number, List<boolean>
      A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, 0, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, T0) -> T0, number, List<boolean>
      "
    `)
  })
})

describe('type checking functions', () => {
  it('happy paths for recursive functions', () => {
    const code1 = `
      function append(xs, ys) {
        return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
      }
    `
    const [program, errors] = typeCheck(parse(code1, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(
      `"append: (List<T0>, List<T0>) -> List<T0>"`
    )
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('unhappy paths for recursive functions', () => {
    const code = `
      function foo(f) {
        return foo;
      }
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: T0"`)
    expect(parseError(errors)).toMatchInlineSnapshot(
      `"Line 2: foo contains cyclic reference to itself"`
    )
    expect(parseError(errors, true)).toMatchInlineSnapshot(`
      "Line 2, Column 6: foo contains cyclic reference to itself
      foo contains cyclic reference to itself
      "
    `)
  })

  it('works for double recursive functions', () => {
    const code1 = `
      function fib(x) {
        return x === 0 ? 1 : x === 1 ? 1 : fib(x - 1) + fib(x - 2);
      }
    `
    const [program, errors] = typeCheck(parse(code1, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"fib: number -> number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('fails with correct error msg when wrong number of args passed in', () => {
    const code = `
      function foo(x) { return x + 1; }
      function goo(x) { return x === 0 ? 1 : goo(x - 1, x - 1); }
      function bar(f) { return f; }
      function baz() { return 0; }
      foo(1, 2);
      bar(foo)(3, 4, 5);
      baz(3);
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: number -> number
      goo: number -> number
      bar: T0 -> T0
      baz: () -> number"
    `)

    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Function expected 1 args, but got 2
      Line 6: Function expected 1 args, but got 2
      Line 7: Function expected 1 args, but got 3
      Line 8: Function expected 0 args, but got 1"
    `)

    expect(parseError(errors, true)).toMatchInlineSnapshot(`
      "Line 3, Column 45: Function expected 1 args, but got 2
      Function expected 1 args, but got 2

      Line 6, Column 6: Function expected 1 args, but got 2
      Function expected 1 args, but got 2

      Line 7, Column 6: Function expected 1 args, but got 3
      Function expected 1 args, but got 3

      Line 8, Column 6: Function expected 0 args, but got 1
      Function expected 0 args, but got 1
      "
    `)
  })

  it('when function used as a parameter fails if wrong function type is passed in', () => {
    const code = `
      function foo(x) { return x + 1; }
      function goo(x) { return x || false; }

      function bar(f) { return f(5) + 1; }
      bar(foo); // okay
      bar(goo); // error
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: number -> number
      goo: boolean -> boolean
      bar: (number -> number) -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 7: A type mismatch was detected in the function call:
        bar(goo)
      The function expected an argument of type:
        number -> number
      but instead received an argument of type:
        boolean -> boolean"
    `)
  })

  it('when we make reference to an undefined identifier in a function catch the error', () => {
    const code = `
      function foo(x, y) {
        append(x, y);
        return 1;
      }
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: (T0, T1) -> number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(
      `"Line 3: Undefined identifier 'append' detected"`
    )
  })
})

describe('type checking pairs', () => {
  it('wrapping pair functions', () => {
    const code = `
function foo(x, y) {
  return pair(x, y);
}
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: (T0, T1) -> [T0, T1]"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('happy paths for pair functions', () => {
    const code = `
function foo(x, y) {
  return pair(x, y);
}
const x = pair(3, 4);
const y = foo(1, 2);
const z = head(x) + 34;
head(x) + 56;
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: (number, number) -> [number, number]
      x: [number, number]
      y: [number, number]
      z: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('unhappy paths for pair functions', () => {
    const code = `
      const x = pair(3, 4);
      const y = head(x) + false;
      const a = pair(3, pair(4, false));
      const b = tail(tail(a)) + 1;
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "x: [number, number]
      y: T0
      a: [number, [number, boolean]]
      b: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: A type mismatch was detected in the binary expression:
        head(x) + false
      The binary operator (+) expected two operands with types:
        addable + addable
      but instead it received two operands of types:
        number + boolean
      Line 5: A type mismatch was detected in the binary expression:
        tail(tail(a)) + 1
      The binary operator (+) expected two operands with types:
        addable + addable
      but instead it received two operands of types:
        boolean + number"
    `)
  })
})

describe('type checking for polymorphic builtin functions', () => {
  it('works in happy case', () => {
    const code = `
      const x = is_boolean('file') || false;
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('errors in unhappy path', () => {
    const code = `
      const x = is_boolean(5);
      x + 5;
    `
    const [, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: A type mismatch was detected in the binary expression:
        x + 5
      The binary operator (+) expected two operands with types:
        addable + addable
      but instead it received two operands of types:
        boolean + number"
    `)
  })
})

describe('type checking of functions with variable number of arguments', () => {
  it('returns an any type', () => {
    const code = `
      const xs = list(1,3,4,4);
      const xs1 = list(false);
      display(1+1);
      display(true, 'hello');
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "xs: T0
      xs1: T0"
    `)
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
      const x = !false;
      const y = x || true;
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: number -> number
      bar: (number, number) -> number
      a: number
      b: number
      c: number
      x: boolean
      y: boolean"
    `)
  })

  it('give reasonable error messages for simple expressions', () => {
    const code = `
      function foo(x, y) {
        return x + y + 4;
      }
      1 ? true : true;
      false ? 1 : false;
      pair(4);
      foo(4, false);
      !3;
      !(3+4);
      1();
      const x = y => y;
      x(1)(2);
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: (number, number) -> number
      x: T0 -> T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 5: Expected the test part of the conditional expression:
        1 ? ... : ...
      to have type boolean, but instead it is type:
        number
      Line 6: The two branches of the conditional expression:
        false ? ... : ...
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        boolean
      Line 7: Function expected 2 args, but got 1
      Line 8: A type mismatch was detected in the function call:
        foo(4, false)
      The function expected 2 arguments of types:
        number, number
      but instead received 2 arguments of types:
        number, boolean
      Line 9: A type mismatch was detected in the unary expression:
        ! 3
      The unary operator (!) expected its operand to be of type:
        boolean
      but instead it received an operand of type:
        number
      Line 10: A type mismatch was detected in the unary expression:
        ! 3 + 4
      The unary operator (!) expected its operand to be of type:
        boolean
      but instead it received an operand of type:
        number
      Line 11: In
        (1)()
      expected
        1
      to be a function type, but instead it is type:
        number
      Line 13: In
        x(1)(2)
      expected
        x(1)
      to be a function type, but instead it is type:
        number"
    `)
  })

  it('errors for unhappy path', () => {
    const code = `
      const a = 4;
      const b = false;
      a + b;
      function foo(x) {return x +1;}
      function bar(x, y) {return x + y;}
      const y = foo(false);
      const c = foo(a) + bar(1, false);
    `
    const [, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 4: A type mismatch was detected in the binary expression:
        a + b
      The binary operator (+) expected two operands with types:
        addable + addable
      but instead it received two operands of types:
        number + boolean
      Line 7: A type mismatch was detected in the function call:
        foo(false)
      The function expected an argument of type:
        number
      but instead received an argument of type:
        boolean
      Line 8: A type mismatch was detected in the function call:
        bar(1, false)
      The function expected 2 arguments of types:
        addable, addable
      but instead received 2 arguments of types:
        number, boolean"
    `)
  })

  it('passes type checking for ternary operators used correctly', () => {
    const code = `
      const a = false;
      const b = 23;
      const c = 4;
      const d = (a || !a) ? b : c;
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "a: boolean
      b: number
      c: number
      d: number"
    `)
  })

  it('fails type checking for ternary operators when test is not boolean', () => {
    const code = `
      const a = 'false';
      const b = 23;
      const c = 4;
      const d = (a ) ? b : c;
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`
          "Line 5: Expected the test part of the conditional expression:
            a ? ... : ...
          to have type boolean, but instead it is type:
            string"
        `)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "a: string
      b: number
      c: number
      d: number"
    `)
  })

  it('fails type checking for ternary operators when consequent does not match the alternate', () => {
    const code = `
      const a = false;
      const b = 23;
      const c = '4';
      const d = (a ) ? b : c;
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`
          "Line 5: The two branches of the conditional expression:
            a ? ... : ...
          produce different types!
          The true branch has type:
            number
          but the false branch has type:
            string"
        `)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "a: boolean
      b: number
      c: string
      d: number"
    `)
  })
})

describe('type checking functions used in polymorphic fashion', () => {
  it('no errors when fn used in polymorhpic fashion after last const decl', () => {
    const code = `
      function f(x) {return x + x;}
      3 + f(4);
      'a' + f('b');
    `

    const [program, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"f: addable -> addable"`)
  })
  it('errors when fn used in polymorhpic fashion before last const decl', () => {
    const code = `
      function f(x) {return x + x;}
      const x = 3 + f(4);
      const y = 'a' + f('b');
    `
    const [, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 4: A type mismatch was detected in the function call:
        f('b')
      The function expected an argument of type:
        number
      but instead received an argument of type:
        string"
    `)
  })
})

describe('typing some SICP Chapter 1 programs', () => {
  it('1.1.1', () => {
    const code = `3 * 2 * (4 + (3 - 5)) + 10 * (27 / 6);`
    const [, errors] = typeCheck(parse(code, 1))
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.1.2', () => {
    const code = `
      const pi = 3.14159;
      const radius = 10;
      pi * radius * radius;
      const circumference = 2 * pi * radius;
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "pi: number
      radius: number
      circumference: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.1.4', () => {
    const code = `
      function square(x) {
        return x * x;
      }
      function sum_of_squares(x,y) {
        return square(x) + square(y);
      }
      function f(a) {
        return sum_of_squares(a + 1, a * 2);
      }
      square(2 + 5);
      square(square(3));
      f(3);
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "square: number -> number
      sum_of_squares: (number, number) -> number
      f: number -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.1.6', () => {
    const code = `
      function abs(x) {
        return x >= 0 ? x : -x;
      }
      function not_equal(x, y) {
        return x > y || x < y;
      }
      function not_equal2(x, y) {
        return !(x >= y && x <= y);
      }
      const a = 3;
      const b = a + 1;
      a + b + a * b;
      a === b;
      b > a && b < a * b
        ? b : a;
      a === 4 ? 6 : b === 4 ? 6 + 7 + a : 25;
      2 + (b > a ? b : a);
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "abs: number -> number
      not_equal: (addable, addable) -> boolean
      not_equal2: (addable, addable) -> boolean
      a: number
      b: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.1.8', () => {
    const code = `
      function square(x) {
        return x * x;
      }
      function average(x,y) {
        return (x + y) / 2;
      }
      function sqrt(x) {
          function good_enough(guess) {
              return math_abs(square(guess) - x) < 0.001;
          }
          function improve(guess) {
              return average(guess, x / guess);
          }
          function sqrt_iter(guess) {
              return good_enough(guess)
                    ? guess
                    : sqrt_iter(improve(guess));
        }
        return sqrt_iter(1.0);
      }
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "square: number -> number
      average: (number, number) -> number
      sqrt: number -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.2.1', () => {
    const code = `
      function factorial(n) {
        return n === 1
              ? 1
              : n * factorial(n - 1);
      }
      function factorial_iter(n) {
        return fact_iter(1, 1, n);
      }
      function fact_iter(product, counter, max_count) {
          return counter > max_count
                ? product
                : fact_iter(counter * product,
                            counter + 1,
                            max_count);
      }
      function A(x,y) {
        return y === 0
              ? 0
              : x === 0
                ? 2 * y
                : y === 1
                  ? 2
                  : A(x - 1, A(x, y - 1));
      }
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "factorial: number -> number
      factorial_iter: number -> number
      fact_iter: (number, number, number) -> number
      A: (number, number) -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.2.2', () => {
    const code = `
      function fib(n) {
        return n === 0
              ? 0
              : n === 1
                ? 1
                : fib(n - 1) + fib(n - 2);
      }
      function fibo(n) {
        return fib_iter(1, 0, n);
      }
      function fib_iter(a, b, count) {
          return count === 0
                ? b
                : fib_iter(a + b, a, count - 1);
      }
      function count_change(amount) {
        return cc(amount, 5);
      }
      function cc(amount, kinds_of_coins) {
        return amount === 0
              ? 1
              : amount < 0 ||
                kinds_of_coins === 0
                ? 0
                : cc(amount, kinds_of_coins - 1)
                  +
                  cc(amount - first_denomination(
                                  kinds_of_coins),
                      kinds_of_coins);
      }
      function first_denomination(kinds_of_coins) {
        return kinds_of_coins === 1 ? 1 :
              kinds_of_coins === 2 ? 5 :
              kinds_of_coins === 3 ? 10 :
              kinds_of_coins === 4 ? 25 :
              kinds_of_coins === 5 ? 50 : 0;
      }
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "fib: number -> number
      fibo: number -> number
      fib_iter: (number, number, number) -> number
      count_change: number -> number
      cc: (number, number) -> number
      first_denomination: number -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.2.4 - 1.2.6', () => {
    const code = `
      function square(x) {
        return x * x;
      }
      function expt(b,n) {
        return n === 0
              ? 1
              : b * expt(b, n - 1);
      }
      function expt2(b,n) {
        return expt_iter(b,n,1);
      }
      function expt_iter(b,counter,product) {
          return counter === 0
                ? product
                : expt_iter(b,
                            counter - 1,
                            b * product);
      }
      function fast_expt(b, n) {
        return n === 0
              ? 1
              : is_even(n)
                ? square(fast_expt(b, n / 2))
                : b * fast_expt(b, n - 1);
      }
      function is_even(n) {
        return n % 2 === 0;
      }
      function gcd(a, b) {
        return b === 0 ? a : gcd(b, a % b);
      }
      function smallest_divisor(n) {
        return find_divisor(n, 2);
      }
      function find_divisor(n, test_divisor) {
        return square(test_divisor) > n
                ? n
                : divides(test_divisor, n)
                  ? test_divisor
                  : find_divisor(n, test_divisor + 1);
      }
      function divides(a, b) {
        return b % a === 0;
      }
      function is_prime(n) {
        return n === smallest_divisor(n);
      }
      function expmod(base, exp, m) {
        return exp === 0
              ? 1
              : is_even(exp)
                ? square(expmod(base, exp / 2, m)) % m
                : (base * expmod(base, exp - 1, m)) % m;
      }
      function fermat_test(n) {
        function try_it(a) {
            return expmod(a, n, n) === a;
        }
        return try_it(1 + math_random());
      }
      function fast_is_prime(n, times) {
        return times === 0
              ? true
              : fermat_test(n)
                ? fast_is_prime(n, times - 1)
                : false;
      }
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "square: number -> number
      expt: (number, number) -> number
      expt2: (number, number) -> number
      expt_iter: (number, number, number) -> number
      fast_expt: (number, number) -> number
      is_even: number -> boolean
      gcd: (number, number) -> number
      smallest_divisor: number -> number
      find_divisor: (number, number) -> number
      divides: (number, number) -> boolean
      is_prime: number -> boolean
      expmod: (number, number, number) -> number
      fermat_test: number -> boolean
      fast_is_prime: (number, number) -> boolean"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.3', () => {
    const code = `
      function sum(term, a, next, b) {
        return a > b
              ? 0
              : term(a) + sum(term, next(a), next, b);
      }
      function cube(x) {
        return x * x * x;
      }
      function inc(n) {
        return n + 1;
      }
      function sum_cubes(a, b) {
        return sum(cube, a, inc, b);
      }
      function identity(x) {
        return x;
      }
      function sum_integers(a, b) {
        return sum(identity, a, inc, b);
      }
      function pi_sum(a, b) {
        function pi_term(x) {
            return 1.0 / (x * (x + 2));
        }
        function pi_next(x) {
            return x + 4;
        }
        return sum(pi_term, a, pi_next, b);
      }
    `
    const [program, errors] = typeCheck(parse(code, 1))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "sum: (number -> number, number, number -> number, number) -> number
      cube: number -> number
      inc: number -> number
      sum_cubes: (number, number) -> number
      identity: number -> number
      sum_integers: (number, number) -> number
      pi_sum: (number, number) -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('typing some SICP Chapter 1 programs', () => {
  it('2.1.1', () => {
    const code = `
      function make_rat(n, d) {
        return pair(n, d);
      }
      function numer(x) {
          return head(x);
      }
      function denom(x) {
          return tail(x);
      }
      function add_rat(x, y) {
        return make_rat(numer(x) * denom(y) + numer(y) * denom(x),
                        denom(x) * denom(y));
      }
      function sub_rat(x, y) {
          return make_rat(numer(x) * denom(y) - numer(y) * denom(x),
                          denom(x) * denom(y));
      }
      function mul_rat(x, y) {
          return make_rat(numer(x) * numer(y),
                          denom(x) * denom(y));
      }
      function div_rat(x, y) {
          return make_rat(numer(x) * denom(y),
                          denom(x) * numer(y));
      }
      function equal_rat(x, y) {
          return numer(x) * denom(y) === numer(y) * denom(x);
      }
      function print_rat(x) {
        display(numer(x));
        display("-");
        display(denom(x));
      }
      const one_half = make_rat(1, 2);

      print_rat(one_half);
      const one_third = make_rat(1, 3);

      print_rat(one_third);
      print_rat(add_rat(one_half, one_third));
      print_rat(mul_rat(one_half, one_third));
      print_rat(div_rat(one_half, one_third));
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "make_rat: (number, number) -> [number, number]
      numer: [number, number] -> number
      denom: [number, number] -> number
      add_rat: ([number, number], [number, number]) -> [number, number]
      sub_rat: ([number, number], [number, number]) -> [number, number]
      mul_rat: ([number, number], [number, number]) -> [number, number]
      div_rat: ([number, number], [number, number]) -> [number, number]
      equal_rat: ([number, number], [number, number]) -> boolean
      print_rat: [number, number] -> undefined
      one_half: [number, number]
      one_third: [number, number]"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('2.2.1', () => {
    const code = `
      function list_ref(items, n) {
        return n === 0
              ? head(items)
              : list_ref(tail(items), n - 1);
      }
      function length(items) {
        return is_null(items)
              ? 0
              : 1 + length(tail(items));
      }
      function length_iterative(items) {
        function length_iter(a, count) {
            return is_null(a)
                  ? count
                  : length_iter(tail(a), count + 1);
        }
        return length_iter(items, 0);
      }
      function map(fun, items) {
        return is_null(items)
              ? null
              : pair(fun(head(items)),
                      map(fun, tail(items)));
      }
      function scale_list(items, factor) {
        return map(x => x * factor, items);
      }
      const squares = list(1, 4, 9, 16, 25);
      list_ref(squares, 3);
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "list_ref: (List<T0>, number) -> T0
      length: List<T0> -> number
      length_iterative: List<T0> -> number
      map: (number -> number, List<number>) -> List<number>
      scale_list: (List<number>, number) -> List<number>
      squares: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
  it('2.2.2', () => {
    const code = `
      function count_leaves(x) {
        return count_leaves(head(x)) +
                  count_leaves(tail(x));
      }
      function scale_tree(tree, factor) {
        return is_null(tree)
              ? null
              : ! is_pair(tree)
                ? tree * factor
                : pair(scale_tree(head(tree), factor),
                        scale_tree(tail(tree), factor));
      }
      const x = pair(pair(1, pair(2,null)), pair(3, pair(4,null)));
      count_leaves(x);
      count_leaves(list(x, x));
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "count_leaves: T0
      scale_tree: T0
      x: T0"
    `)
    // note: our type inferencer simply doesn't work for trees, because of the way we store
    // list internally
    expect(parseError(errors)).toMatchInlineSnapshot(`
          "Line 10: A type mismatch was detected in the binary expression:
            tree * factor
          The binary operator (*) expected two operands with types:
            number * number
          but instead it received two operands of types:
            [T0, T1] * T0
          Line 14: A type mismatch was detected in the function call:
            pair(pair(1, p ... air(2, null)), pair(3, pair(4, null)))
          The function expected 2 arguments of types:
            T0, T0
          but instead received 2 arguments of types:
            List<number>, List<number>
          Line 2: count_leaves contains cyclic reference to itself
          Line 6: scale_tree contains cyclic reference to itself
          Line 14: Error: Failed to unify types"
        `)
  })

  it('2.2.3', () => {
    const code = `
      function is_even(n) {
        return n % 2 === 0;
      }
      function square(x) {
        return x * x;
      }
      function fib(x) {
        return x === 0 ? 1 : x === 1 ? 1 : fib(x - 1) + fib(x - 2);
      }
      function append(xs, ys) {
        return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
      }
      function map(fun, items) {
        return is_null(items)
              ? null
              : pair(fun(head(items)),
                      map(fun, tail(items)));
      }
      function even_fibs(n) {
        function next(k) {
            if (k > n) {
                return null;
            } else {
                const f = fib(k);
                return is_even(f)
                      ? pair(f, next(k + 1))
                      : next(k + 1);
            }
        }
        return next(0);
      }
      function filter(predicate, sequence) {
        return is_null(sequence)
              ? null
              : predicate(head(sequence))
                ? pair(head(sequence),
                        filter(predicate, tail(sequence)))
                : filter(predicate, tail(sequence));
      }
      function accumulate(op, initial, sequence) {
        return is_null(sequence)
              ? initial
              : op(head(sequence),
                    accumulate(op, initial, tail(sequence)));
      }
      function enumerate_interval(low, high) {
        return low > high
              ? null
              : pair(low,
                      enumerate_interval(low + 1, high));
      }
      function remove(item, sequence) {
        return filter(x => !(x === item),
                      sequence);
      }
      filter(is_even, list(1, 2, 3, 4, 5));
      // we type this in a new block to allow for the above functions to be used in a polymorphic manner
      {
        function even_fibs2(n) {
        return accumulate(pair,
                          null,
                          filter(is_even,
                                map(fib,
                                    enumerate_interval(0, n))));
        }
        function list_fib_squares(n) {
          return accumulate(pair,
                            null,
                            map(square,
                                map(fib,
                                    enumerate_interval(0, n))));
        }
        function flatmap(f, seq) {
          return accumulate(append, null, map(f, seq));
        }
        function permutations(s) {
          return is_null(s)
                ? list(null)
                : flatmap(x => map(p => pair(x, p),
                                    permutations(remove(x, s))),
                          s);
        }
      }
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "is_even: number -> boolean
      square: number -> number
      fib: number -> number
      append: (List<T0>, List<T0>) -> List<T0>
      map: (T0 -> T1, List<T0>) -> List<T1>
      even_fibs: number -> List<number>
      filter: (addable -> boolean, List<addable>) -> List<addable>
      accumulate: ((T0, T1) -> T1, T1, List<T0>) -> T1
      enumerate_interval: (number, number) -> List<number>
      remove: (addable, List<addable>) -> List<addable>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})
