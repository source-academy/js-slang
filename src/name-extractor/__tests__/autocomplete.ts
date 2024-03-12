// import { parse } from '../../parser/parser'
import { createContext } from '../..'
import { getNames } from '../../index'
import { Chapter } from '../../types'
import { NameDeclaration } from '../index'

test('Test empty program does not generate names', async () => {
  const code: string = 'f'
  const line = 1
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test simple extraction of constant and variable names', async () => {
  const code: string =
    '\
    const foo1 = 1;\n\
    let foo2 = 2;\n\
    f\
  '
  const line = 3
  const col = 1
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'let', score: 1 },
    { name: 'foo1', meta: 'const', score: 0 }
  ]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test simple extraction of function names', async () => {
  const code: string =
    '\
    function foo1() {\n\
      return true;\n\
    }\n\
    function foo2() {\n\
      return true;\n\
    }\n\
    f\
  '
  const line = 7
  const col = 1
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'func', score: 1 },
    { name: 'foo1', meta: 'func', score: 0 }
  ]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that names in smaller scope are not extracted', async () => {
  const code: string =
    '\
    function baz1() {\n\
      let bar1 = 1;\n\
    }\n\
    function baz2() {\n\
      let bar2 = 1;\n\
    }\n\
    f\
  '
  const line = 7
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'baz2', meta: 'func', score: 1 },
    { name: 'baz1', meta: 'func', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
  expect(extractedNames).not.toContain({ name: 'bar1', meta: 'let' })
  expect(extractedNames).not.toContain({ name: 'bar2', meta: 'let' })
})

test('Test that names in larger scope are extracted', async () => {
  const code: string =
    '\
    let bar1 = 1;\n\
    function foo1() {\n\
      let bar3 = 1;\n\
      function foo2() {\n\
        b\n\
      }\n\
      const bar2 = 1;\n\
      function bar4() {\n\
        const baz = 1;\n\
      }\n\
    }\n\
  '
  const line = 5
  const col = 3
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func', score: 1 },
    { name: 'bar4', meta: 'func', score: 5 },
    { name: 'bar2', meta: 'const', score: 4 },
    { name: 'foo2', meta: 'func', score: 3 },
    { name: 'bar3', meta: 'let', score: 2 },
    { name: 'bar1', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
  expect(extractedNames).not.toContain({ name: 'baz', meta: 'const' })
})

test('Test nested global scope', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    function foo1() {\n\
      function foo2() {\n\
        function foo3() {\n\
          b\n\
      }\n\
    }\
  '
  const line = 5
  const col = 2
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func', score: 1 },
    { name: 'foo2', meta: 'func', score: 2 },
    { name: 'foo3', meta: 'func', score: 3 },
    { name: 'bar', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Function declarations

test('Test that local and global variables are available in function declaration', async () => {
  const code: string =
    '\
    let bar1 = 1;\n\
    function foo1(){\n\
      let bar2 = 2;\n\
      function foo2() {\n\
      }\n\
    }\
  '
  const line = 4
  const col = 26
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func', score: 1 },
    { name: 'foo2', meta: 'func', score: 3 },
    { name: 'bar2', meta: 'let', score: 2 },
    { name: 'bar1', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test accessing parameter names inside function', async () => {
  const code: string =
    '\
    function foo1(bar1, baz1) {\n\
      b\n\
    }\n\
    function foo2(bar2) {\n\
      b\n\
    }\n\
  '
  const line = 2
  const col = 3
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'func', score: 1 },
    { name: 'foo1', meta: 'func', score: 0 },
    { name: 'bar1', meta: 'param', score: 2 },
    { name: 'baz1', meta: 'param', score: 3 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
  expect(extractedNames).not.toContain({ name: 'baz2', meta: 'const' })
})

// For-loops

test('Test accessing local block in for-loop parameter', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    let baz = 2;\n\
    for (b) {\
  '
  const line = 3
  const col = 6
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let', score: 1 },
    { name: 'bar', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test accessing for-loop parameter in for-loop body', async () => {
  const code: string =
    '\
    for (let foo=10;) {\n\
      f\n\
    }\
  '
  const line = 2
  const col = 3
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [{ name: 'foo', meta: 'let', score: 0 }]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that for-loop local variable cannot be accessed outside loop', async () => {
  const code: string =
    '\
    for (let x=1; x<10; x=x+1) {\n\
      let foo = x;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// While-loops

test('Test accessing local block in while-loop parameter', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    let baz = 2;\n\
    while (b) {\
  '
  const line = 3
  const col = 6
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let', score: 1 },
    { name: 'bar', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that while-loop local variable cannot be accessed outside loop', async () => {
  const code: string =
    '\
    while (let x=1; x<10; x=x+1) {\n\
      let foo = x;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Conditionals

test('Test accessing local block in if-else parameter', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    let baz = 2;\n\
    if (b) {\
  '
  const line = 3
  const col = 5
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let', score: 1 },
    { name: 'bar', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that local variable in if-block cannot be accessed in else-block', async () => {
  const code: string =
    '\
    if (true) {\n\
      let foo = x;\n\
    } else {\n\
      f\n\
    }\
  '
  const line = 4
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that variable in if- and else- cannot be accessed outside either block', async () => {
  const code: string =
    '\
    if (true) {\n\
      let foo = 2;\n\
    } else {\n\
      let foo = 1;\n\
    }\n\
    f\
  '
  const line = 6
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that variable in if cannot be accessed outside if-statement', async () => {
  const code: string =
    '\
    function foo(baz) {\n\
      if (baz) {\n\
        let bar = 1;\n\
      }\n\
      b\n\
    }\
  '
  const line = 5
  const col = 2
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo', meta: 'func', score: 0 },
    { name: 'baz', meta: 'param', score: 1 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Blocks

test('Test that declaration in blocks cannot be accessed outside block', async () => {
  const code: string =
    '\
    {\n\
      let foo = 1;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const expectedNames: NameDeclaration[] = []
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that declaration outside blocks can be accessed inside block', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    {\n\
      let baz = 1;\n\
      b\n\
    }\n\
  '
  const line = 4
  const col = 2
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let', score: 1 },
    { name: 'bar', meta: 'let', score: 0 }
  ]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Anonymous functions

test('Test that declaration outside of anonymous functions can be accessed inside', async () => {
  const code: string =
    '\
    let foo = () => { \n\
      let baz = 1;\n\
      b\n\
    }\n\
    let bar = 3;\n\
  '
  const line = 4
  const col = 1
  const expectedNames: NameDeclaration[] = [
    { name: 'bar', meta: 'let', score: 1 },
    { name: 'foo', meta: 'let', score: 0 },
    { name: 'baz', meta: 'let', score: 2 }
  ]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that declaration inside anonymous functions can be accessed in body', async () => {
  const code: string =
    '\
    let foo = (bar1, bar2) => { \n\
      let baz = 1;\n\
      b\n\
    }\n\
  '
  const line = 3
  const col = 2
  const expectedNames: NameDeclaration[] = [
    { name: 'foo', meta: 'let', score: 0 },
    { name: 'bar1', meta: 'param', score: 1 },
    { name: 'bar2', meta: 'param', score: 2 },
    { name: 'baz', meta: 'let', score: 3 }
  ]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that declaration inside anonymous functions cannot be accessed outside', async () => {
  const code: string =
    '\
    let foo = (bar1, bar2) => { \n\
      let baz = 1;\n\
    }\n\
    b\n\
  '
  const line = 4
  const col = 1
  const expectedNames: NameDeclaration[] = [{ name: 'foo', meta: 'let', score: 0 }]
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Return statements

test('Test that local and global variables are available in return statements', async () => {
  const code: string =
    '\
    let bar1 = 1;\n\
    function foo1(){\n\
      let bar2 = 2;\n\
      return b\n\
    }\
  '
  const line = 4
  const col = 7
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func', score: 1 },
    { name: 'bar2', meta: 'let', score: 2 },
    { name: 'bar1', meta: 'let', score: 0 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Declarations
test('Test that no prompts are returned when user is declaring variable', async () => {
  const code: string =
    '\
    let bar = 1;\n\
    let b\n\
  '
  const line = 2
  const col = 9
  const [extractedNames] = await getNames(code, line, col, createContext(0))
  const expectedNames: NameDeclaration[] = []
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

// Builtins
test('Test that builtins are prompted', async () => {
  const code: string = 'w'
  const line = 1
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(Chapter.SOURCE_4))
  const expectedNames: NameDeclaration[] = [
    { name: 'function', meta: 'keyword', score: 20000 },
    { name: 'const', meta: 'keyword', score: 20000 },
    { name: 'let', meta: 'keyword', score: 20000 },
    { name: 'while', meta: 'keyword', score: 20000 },
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 },
    { name: 'for', meta: 'keyword', score: 20000 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test that unavailable builtins are not prompted', async () => {
  const code: string = 'w'
  const line = 1
  const col = 1
  const [extractedNames] = await getNames(code, line, col, createContext(Chapter.SOURCE_1))
  const expectedNames: NameDeclaration[] = [
    { name: 'function', meta: 'keyword', score: 20000 },
    { name: 'const', meta: 'keyword', score: 20000 },
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test keywords in function', async () => {
  const code: string = 'function foo() {r}'
  const line = 1
  const col = 17
  const [extractedNames] = await getNames(code, line, col, createContext(Chapter.SOURCE_4))
  const expectedNames: NameDeclaration[] = [
    { name: 'foo', meta: 'func', score: 0 },
    { name: 'return', meta: 'keyword', score: 20000 },
    { name: 'function', meta: 'keyword', score: 20000 },
    { name: 'const', meta: 'keyword', score: 20000 },
    { name: 'let', meta: 'keyword', score: 20000 },
    { name: 'while', meta: 'keyword', score: 20000 },
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 },
    { name: 'for', meta: 'keyword', score: 20000 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test keywords in while loop', async () => {
  const code: string = 'while (true) {r}'
  const line = 1
  const col = 15
  const [extractedNames] = await getNames(code, line, col, createContext(Chapter.SOURCE_4))
  const expectedNames: NameDeclaration[] = [
    { name: 'break', meta: 'keyword', score: 20000 },
    { name: 'continue', meta: 'keyword', score: 20000 },
    { name: 'function', meta: 'keyword', score: 20000 },
    { name: 'const', meta: 'keyword', score: 20000 },
    { name: 'let', meta: 'keyword', score: 20000 },
    { name: 'while', meta: 'keyword', score: 20000 },
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 },
    { name: 'for', meta: 'keyword', score: 20000 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})

test('Test keywords in for loop', async () => {
  const code: string = 'for(;;){r}'
  const line = 1
  const col = 9
  const [extractedNames] = await getNames(code, line, col, createContext(Chapter.SOURCE_4))
  const expectedNames: NameDeclaration[] = [
    { name: 'break', meta: 'keyword', score: 20000 },
    { name: 'continue', meta: 'keyword', score: 20000 },
    { name: 'function', meta: 'keyword', score: 20000 },
    { name: 'const', meta: 'keyword', score: 20000 },
    { name: 'let', meta: 'keyword', score: 20000 },
    { name: 'while', meta: 'keyword', score: 20000 },
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 },
    { name: 'for', meta: 'keyword', score: 20000 }
  ]
  expect(new Set(extractedNames)).toMatchObject(new Set(expectedNames))
})
