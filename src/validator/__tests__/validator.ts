import { simple } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { TypeAnnotatedNode } from '../../types'
import { getVariableDecarationName } from '../../utils/astCreator'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError } from '../../utils/testing'
import { validateAndAnnotate } from '../validator'

export async function toValidatedAst(code: string) {
  const context = mockContext(1)
  const ast = parse(code, context)
  expect(ast).not.toBeUndefined()
  return validateAndAnnotate(ast as es.Program, context)
}

test('for loop variable cannot be reassigned', async () => {
  const code = stripIndent`
    for (let i = 0; i < 10; i = i + 1) {
      i = 10;
    }
  `
  return expectParsedError(code, { chapter: 4 }).toMatchInlineSnapshot(
    `"Line 2: Assignment to a for loop variable in the for loop is not allowed."`
  )
})

test('for loop variable cannot be reassigned in closure', async () => {
  const code = stripIndent`
    for (let i = 0; i < 10; i = i + 1) {
      function f() {
        i = 10;
      }
    }
  `
  return expectParsedError(code, { chapter: 4 }).toMatchInlineSnapshot(
    `"Line 3: Assignment to a for loop variable in the for loop is not allowed."`
  )
})

test('testing typability', async () => {
  const code = stripIndent`
    const a = 1; // typable
    function f() { // typable
      c;
      return f();
    }
    const b = f(); // typable
    function g() { // not typable
    }
    const c = 1; // not typable
  `
  const ast = await toValidatedAst(code)
  expect(ast).toMatchSnapshot()
  simple(ast, {
    VariableDeclaration(node: TypeAnnotatedNode<es.VariableDeclaration>) {
      let expectedTypability = ''
      switch (getVariableDecarationName(node)) {
        case 'a':
        case 'b':
          expectedTypability = 'NotYetTyped'
          break
        case 'c':
          expectedTypability = 'Untypable'
      }
      expect(node.typability).toBe(expectedTypability)
    },
    FunctionDeclaration(node: TypeAnnotatedNode<es.FunctionDeclaration>) {
      let expectedTypability = ''
      switch (node.id!.name) {
        case 'f':
          expectedTypability = 'NotYetTyped'
          break
        case 'g':
          expectedTypability = 'Untypable'
      }
      expect(node.typability).toBe(expectedTypability)
    }
  })
})
