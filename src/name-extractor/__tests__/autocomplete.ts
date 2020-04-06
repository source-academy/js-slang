// import { parse } from '../../parser/parser'
import { getNames } from '../../index'
import { NameDeclaration } from '../index'

test('Test empty program does not generate names', async () => {
  const code: string = 'f'
  const line = 1
  const col = 1
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = []
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test simple extraction of constant and variable names', async () => {
  const code: string = '\
    const foo1 = 1;\n\
    let foo2 = 2;\n\
    f\
  '
  const line = 3
  const col = 1
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'let' },
    { name: 'foo1', meta: 'const' }
  ]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
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
    { name: 'foo2', meta: 'func' },
    { name: 'foo1', meta: 'func' }
  ]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'baz2', meta: 'func' },
    { name: 'baz1', meta: 'func' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func' },
    { name: 'bar4', meta: 'func' },
    { name: 'bar2', meta: 'const' },
    { name: 'foo2', meta: 'func' },
    { name: 'bar3', meta: 'let' },
    { name: 'bar1', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func' },
    { name: 'foo2', meta: 'func' },
    { name: 'foo3', meta: 'func' },
    { name: 'bar', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})

// Function declarations

test('Test that local and global variables are available in function declaration', async () => {
  const code: string =
    '\
    let bar1 = 1;\n\
    function foo1(){\n\
      let bar2 = 2;\n\
      function foo2()\n\
    }\
  '
  const line = 4
  const col = 15
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func' },
    { name: 'bar2', meta: 'let' },
    { name: 'bar1', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'func' },
    { name: 'foo1', meta: 'func' },
    { name: 'bar1', meta: 'let' },
    { name: 'baz1', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
  expect(extractedNames).not.toContain({ name: 'baz2', meta: 'const' })
})

// For-loops

test('Test accessing local block in for-loop parameter', async () => {
  const code: string = '\
    let bar = 1;\n\
    let baz = 2;\n\
    for (b) {\
  '
  const line = 3
  const col = 6
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let' },
    { name: 'bar', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test accessing for-loop parameter in for-loop body', async () => {
  const code: string = '\
    for (let foo=10;) {\n\
      f\n\
    }\
  '
  const line = 2
  const col = 3
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [{ name: 'foo', meta: 'let' }]
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test that for-loop local variable cannot be accessed outside loop', async () => {
  const code: string = '\
    for (let x=1; x<10; x=x+1) {\n\
      let foo = x;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = []
  expect(extractedNames).toMatchObject(expectedNames)
})

// While-loops

test('Test accessing local block in while-loop parameter', async () => {
  const code: string = '\
    let bar = 1;\n\
    let baz = 2;\n\
    while (b) {\
  '
  const line = 3
  const col = 6
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let' },
    { name: 'bar', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test that while-loop local variable cannot be accessed outside loop', async () => {
  const code: string = '\
    while (let x=1; x<10; x=x+1) {\n\
      let foo = x;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = []
  expect(extractedNames).toMatchObject(expectedNames)
})

// Conditionals

test('Test accessing local block in if-else parameter', async () => {
  const code: string = '\
    let bar = 1;\n\
    let baz = 2;\n\
    if (b) {\
  '
  const line = 3
  const col = 5
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let' },
    { name: 'bar', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test that local variable in if-block cannot be accessed in else-block', async () => {
  const code: string = '\
    if (true) {\n\
      let foo = x;\n\
    } else {\n\
      f\n\
    }\
  '
  const line = 4
  const col = 1
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = []
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = []
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo', meta: 'func' },
    { name: 'baz', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})

// Blocks

test('Test that declaration in blocks cannot be accessed outside block', async () => {
  const code: string = '\
    {\n\
      let foo = 1;\n\
    }\n\
    f\
  '
  const line = 4
  const col = 1
  const expectedNames: NameDeclaration[] = []
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test that declaration outside blocks can be accessed inside block', async () => {
  const code: string = '\
    let bar = 1;\n\
    {\n\
      let baz = 1;\n\
      b\n\
    }\n\
  '
  const line = 4
  const col = 2
  const expectedNames: NameDeclaration[] = [
    { name: 'baz', meta: 'let' },
    { name: 'bar', meta: 'let' }
  ]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
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
    { name: 'bar', meta: 'let' },
    { name: 'foo', meta: 'let' },
    { name: 'baz', meta: 'let' }
  ]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
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
    { name: 'foo', meta: 'let' },
    { name: 'bar1', meta: 'let' },
    { name: 'bar2', meta: 'let' },
    { name: 'baz', meta: 'let' }
  ]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
})

test('Test that declaration inside anonymous functions cannot be accessed outside', async () => {
  const code: string = '\
    let foo = (bar1, bar2) => { \n\
      let baz = 1;\n\
    }\n\
    b\n\
  '
  const line = 4
  const col = 1
  const expectedNames: NameDeclaration[] = [{ name: 'foo', meta: 'let' }]
  const extractedNames = await getNames(code, line, col)
  expect(extractedNames).toMatchObject(expectedNames)
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
  const extractedNames = await getNames(code, line, col)
  const expectedNames: NameDeclaration[] = [
    { name: 'foo1', meta: 'func' },
    { name: 'bar2', meta: 'let' },
    { name: 'bar1', meta: 'let' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
})
