/* tslint:disable:object-literal-key-quotes no-string-literal */
import * as es from 'estree'

import { parseError, runInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { parse as __parse } from '../../parser/parser'
import { Context, TypeAnnotatedFuncDecl, TypeAnnotatedNode } from '../../types'
import { typeToString } from '../../utils/stringify'
import { validateAndAnnotate } from '../../validator/validator'
import { typeCheck } from '../typeChecker'

function parseAndTypeCheck(code: string, chapterOrContext: number | Context = 1) {
  const context =
    typeof chapterOrContext === 'number' ? mockContext(chapterOrContext) : chapterOrContext
  const program: any = __parse(code, context)
  expect(program).not.toBeUndefined()
  const validatedProgram = validateAndAnnotate(program, context)
  return typeCheck(validatedProgram, context)
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
    const context = mockContext(2)

    // we must avoid typechecking library code and user code in the same context
    // else all declarations will be interpreted as one big letrec
    // which can cause the inferred library function types to change.
    const [program1, errors1] = parseAndTypeCheck(context.prelude!, context)
    expect(topLevelTypesToString(program1)).toMatchInlineSnapshot(`
      "equal: (T0, T1) -> boolean
      $length: (List<T0>, number) -> number
      length: List<T0> -> number
      $map: (T0 -> T1, List<T0>, List<T1>) -> List<T1>
      map: (T0 -> T1, List<T0>) -> List<T1>
      $build_list: (number, number -> T0, List<T0>) -> List<T0>
      build_list: (number -> T0, number) -> List<T0>
      for_each: (T0 -> T1, List<T0>) -> boolean
      $list_to_string: (T0, string -> string) -> string
      list_to_string: T0 -> string
      $reverse: (List<T0>, List<T0>) -> List<T0>
      reverse: List<T0> -> List<T0>
      $append: (List<T0>, List<T0>, List<T0> -> List<T0>) -> List<T0>
      append: (List<T0>, List<T0>) -> List<T0>
      member: (addable, List<addable>) -> List<addable>
      $remove: (addable, List<addable>, List<addable>) -> List<addable>
      remove: (addable, List<addable>) -> List<addable>
      $remove_all: (addable, List<addable>, List<addable>) -> List<addable>
      remove_all: (addable, List<addable>) -> List<addable>
      $filter: (T0 -> boolean, List<T0>, List<T0>) -> List<T0>
      filter: (T0 -> boolean, List<T0>) -> List<T0>
      $enum_list: (number, number, List<number>) -> List<number>
      enum_list: (number, number) -> List<number>
      list_ref: (List<T0>, number) -> T0
      $accumulate: ((T0, T1) -> T1, T1, List<T0>, T1 -> T1) -> T1
      accumulate: ((T0, T1) -> T1, T1, List<T0>) -> T1"
    `)
    expect(parseError(errors1)).toMatchInlineSnapshot(`
      "Line 24: A type mismatch was detected in the binary expression:
        xs === ys
      The binary operator (===) expected two operands with types:
        addable === addable
      but instead it received two operands of types:
        T0 -> T1 === T0 -> T1"
    `)

    const code = `
      const xs = pair(1, pair(2, null));
      const y = accumulate((x, y) => x + y, 0, xs);
      const xs1 = map(x => x < 4 ? true : false, xs);
      const xs2 = map(x => x > 4 ? true : false, xs);
      const xs3 = append(xs1, xs2);
    `

    const [program2, errors2] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program2)).toMatchInlineSnapshot(`
      "xs: List<number>
      y: number
      xs1: List<boolean>
      xs2: List<boolean>
      xs3: List<boolean>"
    `)
    expect(parseError(errors2)).toMatchInlineSnapshot(`""`)
  })

  it('works for accumulate used with different kinds of pairs', () => {
    const code = `
      function accumulate(op, init, xs) {
        return is_null(xs) ? init : op(head(xs), accumulate(op, init, tail(xs)));
      }
      const xs = pair(1, pair(2, null));
      const ys = pair(true, pair(true, null));
      accumulate((x,y)=>x+y,0,xs);
      accumulate((x,y)=>x||y,false,ys);
    `
    const [program, errors] = parseAndTypeCheck(code, 2)
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
      const b = accumulate((x,y)=>x||y,false,ys);
    `

    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "accumulate: ((number, number) -> number, number, List<number>) -> number
      xs: List<number>
      ys: List<boolean>
      a: number
      b: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 8: A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, false, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, boolean) -> boolean, boolean, List<boolean>"
    `)
    expect(parseError(errors, true)).toMatchInlineSnapshot(`
      "Line 8, Column 16: A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, false, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, boolean) -> boolean, boolean, List<boolean>
      A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, false, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, boolean) -> boolean, boolean, List<boolean>
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
    const [program, errors] = parseAndTypeCheck(code1, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: T0 -> T1"`)
    expect(parseError(errors)).toMatchInlineSnapshot(
      `"Line 3: foo contains cyclic reference to itself"`
    )
    expect(parseError(errors, true)).toMatchInlineSnapshot(`
      "Line 3, Column 15: foo contains cyclic reference to itself
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
    const [program, errors] = parseAndTypeCheck(code1, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: (T0, T1) -> number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: One or more undeclared names detected (e.g. 'append').
      If there aren't actually any undeclared names, then is either a Source or misconfiguration bug.
      Please report this to the administrators!"
    `)
  })
})

describe('type checking pairs', () => {
  it('wrapping pair functions', () => {
    const code = `
function foo(x, y) {
  return pair(x, y);
}
    `
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('errors in unhappy path', () => {
    const code = `
      const x = is_boolean(5);
      x + 5;
    `
    const [, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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

describe('type checking if else statements', () => {
  it('gives the correct error message even if variable in test is used correctly', () => {
    const code = `
      const a = 2;
      if (a + a) {
        3;
      } else {
        4;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 1)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the if statement:
        if (a + a) { ... } else { ... }
      to have type boolean, but instead it is type:
        number"
    `)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: number"`)
  })
})

describe('type checking functions used in polymorphic fashion', () => {
  it('no errors when fn used in polymorhpic fashion after last const decl', () => {
    const code = `
      function f(x) {return x + x;}
      3 + f(4);
      'a' + f('b');
    `

    const [program, errors] = parseAndTypeCheck(code, 1)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"f: addable -> addable"`)
  })
  it('errors when fn used in polymorhpic fashion before last const decl', () => {
    const code = `
      function f(x) {return x + x;}
      const x = 3 + f(4);
      const y = 'a' + f('b');
    `
    const [, errors] = parseAndTypeCheck(code, 1)
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

describe('Type checking reassignment for Source 3', () => {
  it('errors when trying to reassign a different type', () => {
    const code1 = `
      let z = 4;
      let f = x => x +1;
      let xs = pair(1, pair(1, null));

      z = false || true; // error
      f = x => x || false; // error
      xs = pair(1, pair(1, null)); // okay
      xs = pair(1, null); // okay
      xs = pair(false, pair(false, null)); // not okay
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(errors.length).toEqual(3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "z: number
      f: number -> number
      xs: List<number>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 6: Expected assignment of z:
        false || true
      to get a value of type:
        number
      but got a value of type:
        boolean
      Line 7: Expected assignment of f:
        x => x || fals ... e
      to get a value of type:
        number -> number
      but got a value of type:
        boolean -> boolean
      Line 10: Expected assignment of xs:
        pair(false, pa ... ir(false, null))
      to get a value of type:
        List<number>
      but got a value of type:
        List<boolean>"
    `)
  })

  it('checks for attempts to reassign constants', () => {
    const code1 = `
      let x = 1;
      const y = 1;
      const z = 'test';

      z = false;
      x = 4;
      y = 4; // error
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "x: number
      y: number
      z: string"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 6: Reassignment of constant z
      Line 8: Reassignment of constant y"
    `)
  })

  it('checks for attempts to reassign constants before another const declaration', () => {
    const code1 = `
      let x = 1;
      const y = 1;
      const z = 'test';

      z = false;
      x = 4;
      y = 4; // error
      const a = 3;
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "x: number
      y: number
      z: string
      a: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 6: Reassignment of constant z
      Line 8: Reassignment of constant y"
    `)
  })
})

describe('checking while loops in source 3', () => {
  it('type checks if while loops use a bool type for the test', () => {
    const code = `
      let x = 2;
      x = x + 3;
      while(x <= 1) {
        x = x + 1;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('throws a type error if the test is not of boolean type', () => {
    const code = `
      let x = 1;
      while(x) {
        x = x + 1;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the while statement:
        while (x) { ... }
      to have type boolean, but instead it is type:
        number"
    `)
  })

  it('throws correct error for wrong test type even if variable used correctly', () => {
    const code = `
      let x = 1;
      while(x + x) {
        x = x + 1;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the while statement:
        while (x + x) { ... }
      to have type boolean, but instead it is type:
        number"
    `)
  })

  it('works when there are continue statements in the loop', () => {
    const code = `
      let x = 2;
      x = x + 3;
      while(x <= 1) {
        x = x + 1;
        continue;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('works when there are break statements in the loop', () => {
    const code = `
      let x = 2;
      x = x + 3;
      while(x <= 1) {
        x = x + 1;
        break;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('checking if statements inside functions', () => {
  it('if both blocks dont have return it works and the last stmts have different types it works', () => {
    const code = `
      function f(x) {
        if (x) {
          3;
        } else {
          'string';
        }
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 1)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"f: boolean -> undefined"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('Checking top level blocks', () => {
  it('When using if statements that do not unify at the top level, throw error', () => {
    const code = `
      let a = true;
      if (a) {
        3;
      } else {
        'a';
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: The two branches of the if statement:
        if (a) { ... } else { ... }
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        string"
    `)
  })

  it('When the same if stmts are not the last value producing stmts, no issue', () => {
    const code = `
      let a = true;
      if (a) {
        3;
      } else {
        'a';
      }
      a = a || false;
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('When using while statements that does not unify at the top level, throw error', () => {
    const code = `
      let a = true;
      if (a) {
        3;
      } else {
        while(a) {
          a = a && false;
        }
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: The two branches of the if statement:
        if (a) { ... } else { ... }
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        boolean"
    `)
  })

  it('Passes type checking even if last value returning statement is not the last statement', () => {
    const code = `
      let a = true;
      if (a) {
        a;
      } else {
        while(a) {
          a = a && false;
        }
        const b = 3;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('fails type checking even if last value returning statement is not the last statement', () => {
    const code = `
      let a = true;
      if (a) {
        const c = 4;
      } else {
        while(a) {
          a = a && false;
        }
        const b = 3;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: The two branches of the if statement:
        if (a) { ... } else { ... }
      produce different types!
      The true branch has type:
        undefined
      but the false branch has type:
        boolean"
    `)
  })

  it('fails type checking even if for loop is not the last statement', () => {
    const code = `
      let a = true;
      if (a) {
        const c = 4;
      } else {
        for (let a = 3; a < 5; a = a + 1) {
          a + 20;
        }
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: The two branches of the if statement:
        if (a) { ... } else { ... }
      produce different types!
      The true branch has type:
        undefined
      but the false branch has type:
        number"
    `)
  })
})

describe('type checking for loops', () => {
  it('allows for correctly formed for loops with let outside and inside', () => {
    const code = `
      let a = false;
      for (let a = 3; a < 5; a = a + 1) {
        a + 20;
      }
    `
    // console.log(parse(code, 3).body[1])
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('allows for correctly formed for loops with let outside only', () => {
    const code = `
      let a = 200;
      for (a = 3; a < 5; a = a + 1) {
        a + 20;
      }
    `
    // console.log(parse(code, 3).body[1])
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('fails when test is not a boolean', () => {
    const code = `
      let a = 200;
      for (a = 3; a + 5; a = a + 1) {
        a + 20;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the for statement:
        for (...; a + 5; ...) { ... }
      to have type boolean, but instead it is type:
        number"
    `)
  })

  it('fails when initialized variable not used correctly', () => {
    const code = `
      let a = false;
      for (let a = 3; a < 5; a = a || false) {
        a && a;
      }
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: A type mismatch was detected in the binary expression:
        a || false
      The binary operator (||) expected two operands with types:
        boolean || boolean
      but instead it received two operands of types:
        number || boolean
      Line 3: Expected assignment of a:
        a || false
      to get a value of type:
        number
      but got a value of type:
        boolean
      Line 4: A type mismatch was detected in the binary expression:
        a && a
      The binary operator (&&) expected two operands with types:
        boolean && boolean
      but instead it received two operands of types:
        number && number"
    `)
  })
})

describe('type checking arrays', () => {
  it('handles empty arrays', () => {
    const code = `
      const arr = [];
      const y = 1 + arr[1]; // runtime error but no type error
      arr[0] = false;
      const x = 1 + arr[1]; // type error
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "arr: Array<number>
      y: number
      x: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 4: Expected array type: Array<number>
          but got: Array<boolean>"
    `)
  })
  it('asserts that arrays are used in an monomporhic manner', () => {
    const code1 = `
      const arr1 = [1,2,3,4,5];
      const arr_fail = [1,2,3,4,5, false]; // error
      const arr2 = [false, false, true];
      const arr3 = [x => x+1, x => x+3, x => 2*x];

      // valid index and assignment type
      arr1[1] = 4;
      arr2[2] = false;
      arr3[1] = x => x + 4;

      // invalid index type
      arr1[false] = 3;  // error
      arr1['test'] = 3; // error

      // invalid assignment type
      arr1[1] = false; // error
      arr1[1] || false; // error

      // array indexing on RHS
      const temp = arr1[1];
      const x = 10 + arr1[2];
      const y = !arr1[2]; // error
      const z = 10 + arr3[2](4);
      const a = arr3[2](false); // error

      // built in functions
      const arrLen = array_length(arr1);
      const is_arr = is_array(x);
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "arr1: Array<number>
      arr_fail: Array<number>
      arr2: Array<boolean>
      arr3: Array<number -> number>
      temp: number
      x: number
      y: T0
      z: number
      a: T0
      arrLen: number
      is_arr: boolean"
    `)
    expect(errors.length).toEqual(7)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected array type: Array<number>
          but got: Array<boolean>
      Line 13: Expected array index as number, got boolean instead
      Line 14: Expected array index as number, got string instead
      Line 17: Expected array type: Array<number>
          but got: Array<boolean>
      Line 18: A type mismatch was detected in the binary expression:
        arr1[1] || false
      The binary operator (||) expected two operands with types:
        boolean || boolean
      but instead it received two operands of types:
        number || boolean
      Line 23: A type mismatch was detected in the unary expression:
        ! arr1[2]
      The unary operator (!) expected its operand to be of type:
        boolean
      but instead it received an operand of type:
        number
      Line 25: A type mismatch was detected in the function call:
        arr3[2](false)
      The function expected an argument of type:
        number
      but instead received an argument of type:
        boolean"
    `)
  })
})
describe('typing some SICP Chapter 1 programs', () => {
  it('1.1.1', () => {
    const code = `3 * 2 * (4 + (3 - 5)) + 10 * (27 / 6);`
    const [, errors] = parseAndTypeCheck(code, 1)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('1.1.2', () => {
    const code = `
      const pi = 3.14159;
      const radius = 10;
      pi * radius * radius;
      const circumference = 2 * pi * radius;
    `
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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
    const [program, errors] = parseAndTypeCheck(code, 1)
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

describe('typing some SICP Chapter 2 programs', () => {
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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
    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "count_leaves: List<T0> -> addable
      scale_tree: (number, number) -> List<T0>
      x: T0"
    `)
    // note: our type inferencer simply doesn't work for trees, because of the way we store
    // list internally
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 9: The two branches of the conditional expression:
        !is_pair(tree) ? ... : ...
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        [T0, T0]
      Line 7: The two branches of the conditional expression:
        is_null(tree) ? ... : ...
      produce different types!
      The true branch has type:
        List<T0>
      but the false branch has type:
        number
      Line 14: A type mismatch was detected in the function call:
        pair(pair(1, p ... air(2, null)), pair(3, pair(4, null)))
      The function expected 2 arguments of types:
        T0, T0
      but instead received 2 arguments of types:
        List<number>, List<number>"
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
    const [program, errors] = parseAndTypeCheck(code, 2)
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

describe('typing some SICP Chapter 3 programs', () => {
  it('3.1', () => {
    const code = `
    function factorial(n) {
      let product = 1;
      let counter = 1;
      function iter() {
         if (counter > n) {
             return product;
         } else {
             product = counter * product;
             counter = counter + 1;
             return iter();
         }
      }
      return iter();
   }
   function make_simplified_withdraw(balance) {
    return amount => {
               balance = balance - amount;
               return balance;
           };
}
function make_withdraw_with_balance(balance) {
  return amount => {
      if (balance >= amount) {
          balance = balance - amount;
          return balance;
      } else {
          return "insufficient funds";
      }
  };
}
function make_account(balance) {
  function withdraw(amount) {
      if (balance >= amount) {
          balance = balance - amount;
          return balance;
      } else {
          return "Insufficient funds";
      }
  }
  function deposit(amount) {
      balance = balance + amount;
      return balance;
  }
  function dispatch(m) {
      if (m === "withdraw") {
          return withdraw;
      } else if (m === "deposit") {
          return deposit;
      } else {
          return "Unknown request - - MAKE-ACCOUNT";
      }
  }
  return dispatch;
}
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "factorial: number -> number
      make_simplified_withdraw: number -> number -> number
      make_withdraw_with_balance: number -> number -> number
      make_account: number -> T0 -> number -> number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 24: The two branches of the if statement:
        if (balance >= amo ... unt) { ... } else { ... }
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        string
      Line 34: The two branches of the if statement:
        if (balance >= amo ... unt) { ... } else { ... }
      produce different types!
      The true branch has type:
        number
      but the false branch has type:
        string
      Line 48: The two branches of the if statement:
        if (m === \\"deposit ... \\") { ... } else { ... }
      produce different types!
      The true branch has type:
        number -> number
      but the false branch has type:
        string"
    `)
  })
  it('3.3.1', () => {
    const code1 = `
function front_ptr(queue) {
  return head(queue);
}
function rear_ptr(queue) {
  return tail(queue);
}
function set_front_ptr(queue, item) {
  set_head(queue, item);
}
function set_rear_ptr(queue, item) {
  set_tail(queue, item);
}
function is_empty_queue(queue) {
  return is_null(front_ptr(queue));
}
function make_queue() {
  return pair(null, null);
}
function insert_queue(queue, item) {
  const new_pair = pair(item, null);
  if (is_empty_queue(queue)) {
    set_front_ptr(queue, new_pair);
    set_rear_ptr(queue, new_pair);
  } else {
    set_tail(rear_ptr(queue), new_pair);
    set_rear_ptr(queue, new_pair);
  }
  return queue;
}
function delete_queue(queue) {
  if (is_empty_queue(queue)) {
    // error(queue, "delete_queue called with an empty queue:");
    return queue;
  } else {
    set_front_ptr(queue, tail(front_ptr(queue)));
    return queue;
  }
}
const q1 = make_queue();
insert_queue(q1, "a");
insert_queue(q1, "b");
delete_queue(q1);
delete_queue(q1);
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "front_ptr: List<List<T0>> -> List<T0>
      rear_ptr: List<List<T0>> -> List<List<T0>>
      set_front_ptr: (List<List<T0>>, List<T0>) -> undefined
      set_rear_ptr: (List<List<T0>>, List<List<T0>>) -> undefined
      is_empty_queue: List<List<T0>> -> boolean
      make_queue: () -> List<List<T0>>
      insert_queue: (List<List<T0>>, T1) -> List<List<T0>>
      delete_queue: List<List<T0>> -> List<List<T0>>
      q1: List<List<T0>>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
  it('3.5.1', () => {
    const code1 = `
function stream_tail(stream) {
  return tail(stream)();
}

function stream_ref(s, n) {
  return n === 0
         ? head(s)
         : stream_ref(stream_tail(s), n - 1);
}
function stream_map(f, s) {
  return is_null(s)
         ? null
         : pair(f(head(s)),
                () => stream_map(f, stream_tail(s)));
}
function stream_for_each(fun, s) {
  if (is_null(s)) {
      // return true;
      return undefined;
  } else {
      fun(head(s));
      return stream_for_each(fun, stream_tail(s));
  }
}

const my_stream = pair(4, () => pair(5, () => null));
const my_stream_2 = stream_map(x => x + 1, my_stream);
const x = stream_ref(my_stream, 1);
const y = stream_ref(my_stream_2, 1);
    `
    const [program, errors] = parseAndTypeCheck(code1, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "stream_tail: [number, () -> [number, () -> List<T0>]] -> [number, () -> List<T0>]
      stream_ref: ([number, () -> [number, () -> List<T0>]], number) -> number
      stream_map: (number -> number, [number, () -> [number, () -> List<T0>]]) -> List<number>
      stream_for_each: (number -> T0, [number, () -> [number, () -> List<T1>]]) -> undefined
      my_stream: [number, () -> [number, () -> List<T0>]]
      my_stream_2: List<number>
      x: number
      y: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 12: The two branches of the conditional expression:
        is_null(s) ? ... : ...
      produce different types!
      The true branch has type:
        List<T0>
      but the false branch has type:
        () -> T0
      Line 30: A type mismatch was detected in the function call:
        stream_ref(my_ ... stream_2, 1)
      The function expected 2 arguments of types:
        [number, () -> [number, () -> List<T0>]], number
      but instead received 2 arguments of types:
        List<number>, number"
    `)
  })
})

describe('primitive functions differences between S2 and S3', () => {
  it('source 2 and below restricts === to addables', () => {
    const code = `
      pair(1, 2) === pair(2, 3);
      pair(1, 2) !== pair(2, 3);
    `
    const [program, errors] = parseAndTypeCheck(code, 2)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`""`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 2: A type mismatch was detected in the binary expression:
        pair(1, 2) === pair(2, 3)
      The binary operator (===) expected two operands with types:
        addable === addable
      but instead it received two operands of types:
        [number, number] === [number, number]
      Line 3: A type mismatch was detected in the binary expression:
        pair(1, 2) !== pair(2, 3)
      The binary operator (!==) expected two operands with types:
        addable !== addable
      but instead it received two operands of types:
        [number, number] !== [number, number]"
    `)
  })

  it('source 3 and above allows any type for ===', () => {
    const code = `
      pair(1, 2) === pair(2, 3);
      pair(1, 2) !== pair(2, 3);
    `
    const [program, errors] = parseAndTypeCheck(code, 3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`""`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('Type context from previous executions get saved', () => {
  it('source 1', () => {
    const code1 = `
      const num = 1;
      const f = x => x;
    `
    const context = mockContext(1)
    let [program, errors] = parseAndTypeCheck(code1, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "num: number
      f: T0 -> T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)

    // next eval

    const code2 = `
      const doubleNum = num * 2;
      const g = f;
      const h = f(true);
      const i = f(123);
    `
    ;[program, errors] = parseAndTypeCheck(code2, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "doubleNum: number
      g: T0 -> T0
      h: boolean
      i: number"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('source 2 list functions', async () => {
    const code1 = `
      const xs = pair(true, null);
      const a = map(x=>1, xs);
      const len = length(xs);

      const err = equal(xs, null);
    `
    const context = mockContext(2)
    await runInContext('', context) // we run an empty program to simulate execution of prelude
    const [program, errors] = parseAndTypeCheck(code1, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "xs: List<boolean>
      a: List<number>
      len: number
      err: boolean"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('source 3 stream functions', async () => {
    const code1 = `
      const __is_stream = is_stream;
      const __list_to_stream = list_to_stream;
      const __stream_to_list = stream_to_list;
      const __stream_length = stream_length;
      const __stream_map = stream_map;
      const __build_stream = build_stream;
      const __stream_for_each = stream_for_each;
      const __stream_reverse = stream_reverse;
      const __stream_append = stream_append;
      const __stream_member = stream_member;
      const __stream_remove = stream_remove;
      const __stream_remove_all = stream_remove_all;
      const __stream_filter = stream_filter;
      const __enum_stream = enum_stream;
      const __integers_from = integers_from;
      const __eval_stream = eval_stream;
      const __stream_ref = stream_ref;
    `
    const context = mockContext(3)
    await runInContext('', context) // we run an empty program to simulate execution of prelude
    const [program, errors] = parseAndTypeCheck(code1, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "__is_stream: T0 -> boolean
      __list_to_stream: List<T0> -> T1
      __stream_to_list: T0 -> List<T1>
      __stream_length: T0 -> number
      __stream_map: T0 -> T1
      __build_stream: (number, number -> T0) -> T1
      __stream_for_each: (T0 -> T1) -> boolean
      __stream_reverse: T0 -> T0
      __stream_append: (T0, T0) -> T0
      __stream_member: (T0, T1) -> T1
      __stream_remove: (T0, T1) -> T1
      __stream_remove_all: (T0, T1) -> T1
      __stream_filter: (T0 -> boolean, T1) -> T1
      __enum_stream: (number, number) -> T0
      __integers_from: number -> T0
      __eval_stream: (T0, number) -> List<T1>
      __stream_ref: (T0, number) -> T1"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })
})

describe('imported vars have any type', () => {
  it('import', () => {
    const code1 = `
      import {show, heart, nova as supernova} from 'runes';
      const a = show;
      const b = heart;
      const c = supernova;

      // error
      const illegal = not_imported;
    `
    const [program, errors] = parseAndTypeCheck(code1, 1)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "a: T0
      b: T0
      c: T0
      illegal: T0"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 8: One or more undeclared names detected (e.g. 'not_imported').
      If there aren't actually any undeclared names, then is either a Source or misconfiguration bug.
      Please report this to the administrators!"
    `)
  })
})

describe('predicate tests work as expected', () => {
  it('predicate tests shield outer type environment from stricter type constraints', () => {
    const code = `
      function is_number_pair(xs) {
        if (is_pair(xs)) {
          return is_number(head(xs)) && is_number(tail(xs));
        } else {
          return false;
        }
      }

      function is_number_pair2(xs) {
        return is_pair(xs) && is_number(head(xs)) && is_number(tail(xs));
      }
    `
    const context = mockContext(2)
    const [program, errors] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "is_number_pair: T0 -> boolean
      is_number_pair2: T0 -> boolean"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('predicate tests occurring in positive positions of boolean expressions are detected', () => {
    const code = `
      function is_number_pair(xs) {
        if (!!(!(!is_pair(xs) || !is_pair(xs) || 1 === 2) && 1 === 1)) {
          return is_number(head(xs)) && is_number(tail(xs));
        } else {
          return false;
        }
      }
    `
    const context = mockContext(2)
    const [program, errors] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"is_number_pair: T0 -> boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('predicate tests occurring in negative positions of boolean expressions are detected', () => {
    const code = `
      function is_number_pair(xs) {
        if (!!!(!(!is_pair(xs) || !is_pair(xs) || 1 === 2) && 1 === 1)) {
          return false;
        } else {
          return is_number(head(xs)) && is_number(tail(xs));
        }
      }
    `
    const context = mockContext(2)
    const [program, errors] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"is_number_pair: T0 -> boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('inconsistent predicate tests raise type error', () => {
    const code = `
      function fails(xs) {
        if (is_pair(xs) && is_number(xs)) {
          return is_number(head(xs)) && is_number(tail(xs));
        } else {
          return false;
        }
      }
    `
    const context = mockContext(2)
    const [program, errors] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"fails: T0 -> boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Inconsistent type constraints when trying to apply the predicate test
        is_number(xs)
      It is inconsistent with the predicate tests applied before it.
      The variable xs has type
        [T0, T1]
      but could not unify with type
        number"
    `)
  })

  it('body inconsistent with predicate raises type error', () => {
    const code = `
      function fails(xs) {
        if (is_number(xs)) {
          return is_number(head(xs)) && is_number(tail(xs));
        } else {
          return false;
        }
      }
    `
    const context = mockContext(2)
    const [program, errors] = parseAndTypeCheck(code, context)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"fails: T0 -> boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 4: A type mismatch was detected in the function call:
        head(xs)
      The function expected an argument of type:
        [T0, T1]
      but instead received an argument of type:
        number
      Line 4: A type mismatch was detected in the function call:
        tail(xs)
      The function expected an argument of type:
        [T0, T1]
      but instead received an argument of type:
        number"
    `)
  })
})

describe('equal has correct type', () => {
  it('import', async () => {
    const code1 = `
      const f = equal;
    `
    const context = mockContext(2)
    await runInContext('', context) // we run an empty program to simulate execution of prelude
    const [program, errors] = parseAndTypeCheck(code1, context)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"f: (T0, T1) -> boolean"`)
  })
})
