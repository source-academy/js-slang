import type es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, type NodeWithInferredType } from '../../types'
import { getVariableDeclarationName } from '../../utils/ast/astCreator'
import { stripIndent } from '../../utils/formatters'
import { expectTrue } from '../../utils/testing'
import { astTester } from '../../utils/testing/testers'
import { simple } from '../../utils/walkers'
import { checkForUndefinedVariables, validateAndAnnotate } from '../validator'
import { UndefinedVariable } from '../../errors/errors'
import { parseError, runInContext } from '../..'

describe(`Test ${validateAndAnnotate.name}`, () => {
  astTester(
    (program, context, expected) => {
      validateAndAnnotate(program, context)
      if (expected === undefined) {
        expect(context.errors.length).toEqual(0)
      } else {
        expect(parseError(context.errors)).toEqual(expected)
      }
    },
    [
      [
        'for loop variable cannot be reassigned',
        `for (let i = 0; i < 10; i = i + 1) {
          i = 10;
        }
        `,
        'Line 2: Assignment to a for loop variable in the for loop is not allowed.'
      ],
      [
        'for loop variable cannot be reassigned in closure',
        `for (let i = 0; i < 10; i = i + 1) {
          function f() {
            i = 10;
          }
        }
        `,
        'Line 3: Assignment to a for loop variable in the for loop is not allowed.'
      ],
      [
        'function name cannot be reassigned',
        'function a() { a = 0; }',
        'Line 1: Cannot assign new value to constant a.'
      ],
      [
        'function name can be redeclared (and then reassigned)',
        'function a() { let a = 0; a = 1; return a; }'
      ]
    ]
  )

  test('testing typability', () => {
    function toValidatedAst(code: string) {
      const context = mockContext(Chapter.SOURCE_1)
      const ast = parse(code, context)
      expect(ast).not.toBeUndefined()
      return validateAndAnnotate(ast as es.Program, context)
    }

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
        switch (getVariableDeclarationName(node)) {
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
})

describe(`Test ${checkForUndefinedVariables.name}`, () => {
  astTester(
    (program, context, expected) => {
      let err = null
      try {
        checkForUndefinedVariables(program, context, {} as any, false)
      } catch (error) {
        err = error
      }

      if (expected === undefined) {
        expect(err).toBeNull()
        expect(context.errors.length).toEqual(0)
      } else {
        expect(err).toBeInstanceOf(UndefinedVariable)
        expect(parseError([err])).toEqual(expected)
      }
    },
    [
      // ArrowFunctionExpressions
      [
        'ArrowFunctionExpression bodies are checked',
        'const a = () => b;',
        'Line 1: Name b not declared.'
      ],
      [
        'ArrowFunctionExpression bodies are checked',
        'const a = () => { b; };',
        'Line 1: Name b not declared.'
      ],
      ['ArrowFunctionExpression parameters are valid declarations', 'const a = b => { b; };'],
      ['ArrowFunctionExpressions can call themselves recursively', 'const a = () => a();'],

      // Function declarations
      ['function bodies are checked', 'function a() { b; }', 'Line 1: Name b not declared.'],
      ['function names can be called recursively', 'function a() { a; }'],
      ['function parameters are considered valid declarations', 'function a(b) { b; return a(); }'],

      // Function expressions
      [
        'FunctionExpression bodies are checked',
        'const a = function() { return b; }',
        'Line 1: Name b not declared.'
      ],
      [
        'FunctionExpression parameters are valid declarations',
        'const a = function(b) { return b; }'
      ],
      ['FunctionExpressions can call themselves recursively', 'const a = function() { a(); }'],

      // For loops
      ['for loop init variable counts', 'for (let i = 0; i < 0; i = i + 1) { i; }'],
      [
        'for loop init is checked',
        'for (i = 0; i < 0; i = i + 1) { i; }',
        'Line 1: Name i not declared.'
      ],
      [
        'for loop test is checked',
        'for (let i = 0; a < 0; i = i + 1) { i; }',
        'Line 1: Name a not declared.'
      ],
      [
        'for loop update is checked',
        'for (let i = 0; i < 0; a = i + 1) { i; }',
        'Line 1: Name a not declared.'
      ],
      [
        'for loops bodies are checked',
        'for (let i = 0; i < 0; i = i + 1) { a; }',
        'Line 1: Name a not declared.'
      ],
      ['for in statement declaration is valid', 'for (const [x, y] in []) { x; y; }'],
      ['for in statement is checked', 'for (const x in a) { x; }', 'Line 1: Name a not declared.'],
      ['for of statement declaration is valid', 'for (const {x, y} of []) { x; y; }'],
      [
        'destructuring expression in for of is checked 1',
        `
          let x = 0, y = 0;
          for ({x, y} of []) {}
        `
      ],
      [
        'destructuring expression in for of is checked 2',
        'for ({x, y} of []) {}',
        'Line 1: Name x not declared.'
      ],
      ['for of statement is checked', 'for (const x in a) { x; }', 'Line 1: Name a not declared.'],

      // Try statement
      ['try statement body is checked', 'try { a; } catch(e) {}', 'Line 1: Name a not declared.'],
      ['catch clauses are checked', 'try {} catch(e) { a; }', 'Line 1: Name a not declared.'],
      ['catch clause parameter is a valid identifier', 'try {} catch(e) { e; }'],
      ['finally blocks are checked', 'try {} finally { a; }', 'Line 1: Name a not declared.'],

      // BlockStatements and Programs
      [
        'names in upper scopes are valid declarations',
        `
        const a = "a";
        {
          {
            a;
          }
        }
        `
      ],
      [
        'names in lower scopes are not accessible by upper scopes',
        `a;
        {
          const a = "a";
        }
        `,
        'Line 1: Name a not declared.'
      ],
      [
        'names in sibling scopes are inaccessible',
        `{
          { const a = "a"; }
          { a; }
        }
        `,
        'Line 3: Name a not declared.'
      ],

      // Builtins and Preludes
      ['identifiers in builtins are valid', 'pair();'],
      ['identifiers in preludes are valid', 'stream();']
    ],
    Chapter.FULL_JS
  )

  test('previous program identifiers are also valid', async () => {
    const context = mockContext(Chapter.SOURCE_4)
    await runInContext('const x = 0;', context)

    const newProgram = parse('x+1;', context)
    expectTrue(!!newProgram)

    expect(() => checkForUndefinedVariables(newProgram, context, {} as any, false)).not.toThrow()
  })
})
