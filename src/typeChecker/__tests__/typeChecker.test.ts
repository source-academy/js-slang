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
"accumulate: ((number, number) -> number, number, [number, List<number>]) -> number
map: (number -> boolean, [number, List<number>]) -> [boolean, List<boolean>]
append: ([boolean, List<boolean>], [boolean, List<boolean>]) -> [boolean, List<boolean>]
remove: (T185, [T185, List<T185>]) -> [T185, List<T185>]
xs: [number, List<number>]
y: number
xs1: [boolean, List<boolean>]
xs2: [boolean, List<boolean>]
xs3: [boolean, List<boolean>]"
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
"accumulate: ((T67, T21) -> T21, T21, [T67, List<T67>]) -> T21
xs: [number, List<number>]
ys: [boolean, List<boolean>]"
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
"accumulate: ((number, number) -> number, number, [number, List<number>]) -> number
xs: [number, List<number>]
ys: [boolean, List<boolean>]
a: number
b: number"
`)
    expect(parseError(errors)).toMatchInlineSnapshot(`
"Line 8: Types do not unify: number vs boolean
Line 8: Types do not unify: boolean vs number"
`)
  })
})

// describe('type checking functions', () => {
//   it('happy paths for recursive functions', () => {
//     const code1 = `
//       function append(xs, ys) {
//         return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
//       }
//     `
//     const [program, errors] = typeCheck(parse(code1, 2))
//     expect(topLevelTypesToString(program)).toMatchInlineSnapshot(
//       `"append: ([T29, List<T29>], [T29, List<T29>]) -> [T29, List<T29>]"`
//     )
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//   })

//   it('unhappy paths for recursive functions', () => {
//     const code = `
//       function foo(f) {
//         return foo;
//       }
//     `
//     const [program, errors] = typeCheck(parse(code, 2))
//     expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"foo: Couldn't infer type"`)
//     expect(parseError(errors)).toMatchInlineSnapshot(`
// "Line 1: Contains cyclic reference to itself, where the type being bound to is a function type
// Line 2: Error: Contains cyclic reference to itself, where the type being bound to is a function type
// Line 2: Error: Contains cyclic reference to itself, where the type being bound to is a function type
// Line 3: Error: Contains cyclic reference to itself, where the type being bound to is a function type
// Line 3: Error: Contains cyclic reference to itself, where the type being bound to is a function type"
// `)
//   })
// })

// describe('type checking pairs', () => {
//   it('wrapping pair functions', () => {
//     const code = `
// function foo(x, y) {
//   return pair(x, y);
// }
//     `
//     const [program, errors] = typeCheck(parse(code, 2))
//     expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`"foo: (T3, T4) -> [T3, T4]"`)
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//   })

//   it('happy paths for pair functions', () => {
//     const code = `
// function foo(x, y) {
//   return pair(x, y);
// }
// const x = pair(3, 4);
// const y = foo(1, 2);
// const z = head(x) + 34;
// head(x) + 56;
//     `
//     const [program, errors] = typeCheck(parse(code, 2))
//     expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`
// "foo: (number, number) -> [number, number]
// x: [number, number]
// y: [number, number]
// z: number"
// `)
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//   })

//   it('unhappy paths for pair functions', () => {
//     const code = `
//       const x = pair(3, 4);
//       const y = head(x) + false;
//       const a = pair(3, pair(4, false));
//       const b = tail(tail(a)) + 1;
//     `
//     // @ts-ignore
//     const [_program, errors] = typeCheck(parse(code, 2))
//     expect(parseError(errors)).toMatchInlineSnapshot(`
// "Line 3: Expected either a number or a string, got boolean instead.
// Line 5: Expected either a number or a string, got boolean instead."
// `)
//   })
// })

// describe('type checking for polymorphic builtin functions', () => {
//   it('works in happy case', () => {
//     const code = `
//       const x = is_boolean('file') || false;
//     `
//     const [program, errors] = typeCheck(parse(code, 2))
//     expect(topLevelTypesToString(program)).toMatchInlineSnapshot(`"x: boolean"`)
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//   })

//   it('errors in unhappy path', () => {
//     const code = `
//       const x = is_boolean(5) + 5;
//     `
//     // @ts-ignore
//     const [_program, errors] = typeCheck(parse(code, 1))
//     expect(parseError(errors)).toMatchInlineSnapshot(
//       `"Line 2: Expected either a number or a string, got boolean instead."`
//     )
//   })
// })

// describe('type checking overloaded unary/binary primitives', () => {
//   it('works for the happy path', () => {
//     const code = `
//       function foo(x) {return x + 1;}
//       function bar(x, y) {return x + y;}
//       const a = 5;
//       const b = 3;
//       const c = foo(a) + bar(1, b);
//       3 + 4;
//       const x = !false;
//       const y = x || true;
//     `
//     const [program, errors] = typeCheck(parse(code, 1))
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//     expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(
//       `
// "foo: number -> number
// bar: (number, number) -> number
// a: number
// b: number
// c: number
// x: boolean
// y: boolean"
// `
//     )
//   })

//   it('errors for unhappy path', () => {
//     const code = `
//       const a = 4;
//       const b = false;
//       a + b;
//       function foo(x) {return x +1;}
//       function bar(x, y) {return x + y;}
//       const y = foo(false);
//       const c = foo(a) + bar(1, false);
//     `
//     // @ts-ignore
//     const [_program, errors] = typeCheck(parse(code, 1))
//     expect(parseError(errors)).toMatchInlineSnapshot(`
// "Line 4: Expected either a number or a string, got boolean instead.
// Line 7: Types do not unify: boolean vs number
// Line 8: Expected either a number or a string, got boolean instead."
// `)
//   })
// })

// describe('type checking functions used in polymorphic fashion', () => {
//   it('no errors when fn used in polymorhpic fashion after last const decl', () => {
//     const code = `
//       function f(x) {return x + x;}
//       3 + f(4);
//       'a' + f('b');
//     `

//     const [program, errors] = typeCheck(parse(code, 1))
//     expect(parseError(errors)).toMatchInlineSnapshot(`""`)
//     expect(topLevelTypesToString(program!)).toMatchInlineSnapshot(`"f: T21 -> T21"`)
//   })
//   it('errors when fn used in polymorhpic fashion before last const decl', () => {
//     const code = `
//       function f(x) {return x + x;}
//       const x = 3 + f(4);
//       const y = 'a' + f('b');
//     `
//     // @ts-ignore
//     const [_program, errors] = typeCheck(parse(code, 1))
//     expect(parseError(errors)).toMatchInlineSnapshot(`
// "Line 4: Types do not unify: number vs string
// Line 4: Types do not unify: string vs number"
// `)
//   })
// })
