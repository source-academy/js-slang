// import { parse } from '../../parser/parser'
import { getNames } from '../../index'
import { NameDeclaration } from '../index'

// test('Test empty program does not generate names', async () => {
//   const code: string = "f"
//   const line = 1
//   const col = 1
//   const extractedNames = await getNames(code, line, col)
//   const expectedNames: NameDeclaration[] = []
//   expect(extractedNames).toMatchObject(expectedNames)
// })

test('Test simple extraction of constant and variable names', async () => {
  const code: string = '\
    const foo1 = 1;\n\
    var foo2 = 2;\n\
    f\
  '
  const line = 3
  const col = 1
  const expectedNames: NameDeclaration[] = [
    { name: 'foo2', meta: 'var' },
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
      var bar1 = 1;\n\
    }\n\
    function baz2() {\n\
      var bar2 = 1;\n\
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
  expect(extractedNames).not.toContain({ name: 'bar1', meta: 'var' })
  expect(extractedNames).not.toContain({ name: 'bar2', meta: 'var' })
})

test('Test that names in larger scope are extracted', async () => {
  const code: string =
    '\
    var bar1 = 1;\n\
    function foo1() {\n\
      var bar3 = 1;\n\
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
    { name: 'bar3', meta: 'var' },
    { name: 'bar1', meta: 'var' }
  ]
  expect(extractedNames).toMatchObject(expectedNames)
  expect(extractedNames).not.toContain({ name: 'baz', meta: 'const' })
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

// Test extraction of
test('Test accessing parameter names inside function', async () => {
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
  expect(extractedNames).not.toContain({ name: 'baz2', meta: 'const' })
})

// Conditionals

// Test that conditionals can access outside scope

// Test that variables in for loops can be accessed inside the for loop
