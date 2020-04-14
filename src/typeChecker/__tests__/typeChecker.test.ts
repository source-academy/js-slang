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
      "accumulate: ((T67, T4) -> T4, T4, List<T67>) -> T4
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
      b: T53"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 8: A type mismatch was detected in the function call:
        accumulate((x, ...  y) => x || y, 0, ys)
      The function expected 3 arguments of types:
        (number, number) -> number, number, List<number>
      but instead received 3 arguments of types:
        (boolean, T57) -> T57, number, List<boolean>"
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
      `"append: (List<T25>, List<T25>) -> List<T25>"`
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
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: T2"`)
    expect(parseError(errors)).toMatchInlineSnapshot(
      `"Line 2: foo contains cyclic reference to itself"`
    )
  })

  it('fails with correct error msg when wrong number of args passed in', () => {
    const code = `
      function foo(x) { return x + 1; }
      function goo(x) { return x === 0 ? 1 : goo(x - 1, x - 1); }
      function bar(f) { return f; }
      foo(1, 2);
      bar(foo)(3, 4, 5);
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "foo: number -> number
      goo: number -> number
      bar: T29 -> T29"
    `)

    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Function expected 1 args, but got 2
      Line 5: Function expected 1 args, but got 2
      Line 6: Function expected 1 args, but got 3"
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
})

describe('type checking pairs', () => {
  it('wrapping pair functions', () => {
    const code = `
function foo(x, y) {
  return pair(x, y);
}
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`"foo: (T11, T12) -> [T11, T12]"`)
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
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`
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
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`
      "x: [number, number]
      y: T7
      a: [number, [number, boolean]]
      b: T21"
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
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`
      "xs: T2
      xs1: T9"
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
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`
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
    `
    const [program, errors] = typeCheck(parse(code, 2))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(
      `"foo: (number, number) -> number"`
    )
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
    expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`"f: addable -> addable"`)
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
    const [program, errors] = typeCheck(parse(code1, 3))
    expect(errors.length).toEqual(3)
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "z: number
      f: number -> number
      xs: List<number>"
    `)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 6: Expected reassignment of z:
        false || true
      to be of type:
        number
      but got:
        boolean
      Line 7: Expected reassignment of f:
        x => x || fals ... e
      to be of type:
        number -> number
      but got:
        boolean -> boolean
      Line 10: Expected reassignment of xs:
        pair(false, pa ... ir(false, null))
      to be of type:
        List<number>
      but got:
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
    const [program, errors] = typeCheck(parse(code1, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the while statement:
        while (x) { ... }
      to have type boolean, but instead it is type:
        number"
    `)
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
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
  it('allows for correctly formed for loops with let outside', () => {
    const code = `
      let a = false;
      for (let a = 3; a < 5; a = a + 1) {
        a + 20;
      }
    `
    // console.log(parse(code, 3).body[1])
    const [program, errors] = typeCheck(parse(code, 3))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`""`)
  })

  it('allows for correctly formed for loops with let inside', () => {
    const code = `
      let a = 200;
      for (a = 3; a < 5; a = a + 1) {
        a + 20;
      }
    `
    // console.log(parse(code, 3).body[1])
    const [program, errors] = typeCheck(parse(code, 3))
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
    const [program, errors] = typeCheck(parse(code, 3))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: number"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Expected the test part of the for statement:
        for (...; a + 5; ...) { ... }
      to have type boolean, but instead it is type:
        boolean"
    `)
  })

  it('fails when initialized variable not used correctly', () => {
    const code = `
      let a = false;
      for (let a = 3; a < 5; a = a || false) {
        a && a;
      }
    `
    const [program, errors] = typeCheck(parse(code, 3))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"a: boolean"`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: A type mismatch was detected in the binary expression:
        a || false
      The binary operator (||) expected two operands with types:
        boolean || T20
      but instead it received two operands of types:
        number || boolean
      Line 4: A type mismatch was detected in the binary expression:
        a && a
      The binary operator (&&) expected two operands with types:
        boolean && T21
      but instead it received two operands of types:
        number && number"
    `)
  })
})

describe('type checking arrays', () => {
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
    const [program, errors] = typeCheck(parse(code1, 3))
    expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`
      "arr1: Array<number>
      arr_fail: Array<number>
      arr2: Array<boolean>
      arr3: Array<number -> number>
      temp: number
      x: number
      y: T95
      z: number
      a: T108
      arrLen: number
      is_arr: boolean"
    `)
    expect(errors.length).toEqual(7)
    expect(parseError(errors)).toMatchInlineSnapshot(`
      "Line 3: Array expected type: Array<number>
          but got: boolean
      Line 13: Expected array index as number, got boolean instead
      Line 14: Expected array index as number, got string instead
      Line 17: Array expected type: Array<number>
          but got: boolean
      Line 18: A type mismatch was detected in the binary expression:
        arr1[1] || false
      The binary operator (||) expected two operands with types:
        boolean || T128
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
