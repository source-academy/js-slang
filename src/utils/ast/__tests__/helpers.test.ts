import { describe, expect, test } from 'vitest'
import type { Node, VariableDeclaration } from 'estree'
import { parse } from 'acorn'
import { extractDeclarations, getSourceVariableDeclaration } from '../helpers'
import { sanitizeAST } from '../../testing/sanitizer'
import { ACORN_PARSE_OPTIONS } from '../../../constants'

function getAst(code: string) {
  const program = parse(code, ACORN_PARSE_OPTIONS)
  return sanitizeAST(program.body[0] as Node)
}

describe(getSourceVariableDeclaration, () => {
  test('works with a typical VariableDeclaration', () => {
    const result = getSourceVariableDeclaration(getAst('const x = 0;') as VariableDeclaration)
    expect(result).toEqual({
      id: {
        type: 'Identifier',
        name: 'x'
      },
      init: {
        type: 'Literal',
        value: 0
      },
      loc: undefined
    })
  })

  test('throws an error when given a declaration with multiple declarators', () => {
    expect(() =>
      getSourceVariableDeclaration(getAst('const x = 0, y = 0;') as VariableDeclaration)
    ).toThrowError('Variable Declarations in Source should only have 1 declarator!')
  })

  test('throws an error when given an uninitialized declaration', () => {
    expect(() =>
      getSourceVariableDeclaration(getAst('let x;') as VariableDeclaration)
    ).toThrowError('Variable declarations in Source must be initialized!')
  })
})

describe(extractDeclarations, () => {
  function getIdentifiers(code: string) {
    const ids = extractDeclarations(getAst(code) as VariableDeclaration)
    return ids.map(({ name }) => name)
  }

  test('simple single declaration', () => {
    expect(getIdentifiers('const x = 0;')).toContain('x')
  })

  test('multiple simple declarations', () => {
    const ids = getIdentifiers('const x = 0, y = 0;')
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })

  test('simple object pattern', () => {
    const ids = getIdentifiers('const { x, y } = {};')
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })

  test('simple object pattern with computed key', () => {
    const ids = getIdentifiers('const { [0]: x, y } = {};')
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })

  test('complex object pattern', () => {
    const ids = getIdentifiers('const { x, y: { a, b } } = {};')

    expect(ids).toContain('x')
    expect(ids).not.toContain('y')
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  test('complex object pattern 2', () => {
    const ids = getIdentifiers('const { x: { c, d }, y: { a, b } } = {};')

    expect(ids).not.toContain('x')
    expect(ids).not.toContain('y')
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    expect(ids).toContain('d')
  })

  test('simple array pattern', () => {
    const ids = getIdentifiers('const [a, b] = [];')

    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  test('nested array pattern', () => {
    const ids = getIdentifiers('const [[a, b], [[c], d], e] = [];')

    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('e')
  })

  test('array + object patterns', () => {
    const ids = getIdentifiers('const { x: [a, { b }], y: { c, z: [d, [e]] }} = 0')

    expect(ids).not.toContain('x')
    expect(ids).not.toContain('y')
    expect(ids).not.toContain('z')

    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('e')
  })
})
