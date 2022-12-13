import * as es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, NodeWithInferredType } from '../../types'
import { getVariableDecarationName } from '../../utils/astCreator'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError } from '../../utils/testing'
import { simple } from '../../utils/walkers'
import { validateAndAnnotate } from '../validator'

export function toValidatedAst(code: string) {
  const context = mockContext(Chapter.SOURCE_1)
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
  return expectParsedError(code, { chapter: Chapter.SOURCE_4 }).toMatchInlineSnapshot(
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
  return expectParsedError(code, { chapter: Chapter.SOURCE_4 }).toMatchInlineSnapshot(
    `"Line 3: Assignment to a for loop variable in the for loop is not allowed."`
  )
})

test('testing typability', () => {
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
  const ast = toValidatedAst(code)
  expect(ast).toMatchSnapshot()
  simple(ast, {
    VariableDeclaration(node: NodeWithInferredType<es.VariableDeclaration>) {
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
    FunctionDeclaration(node: NodeWithInferredType<es.FunctionDeclaration>) {
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
