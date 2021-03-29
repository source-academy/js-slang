import * as es from 'estree'
import { gpuRuntimeTranspile } from '../transfomer'
import { parse } from 'acorn'
import { simple } from '../../utils/walkers'

test('gpuRuntimeTranspile replaces math function identifiers', () => {
  const program = `
    (i, j, k) => {
      const x = math_max(1, 2);
      return x;
    }`
  const node = (parse(program, { ecmaVersion: 6 }) as unknown) as es.Program
  const expr = node.body[0] as es.ExpressionStatement
  const arrowFn = expr.expression as es.ArrowFunctionExpression
  const localNames = new Set<string>()
  localNames.add('x')
  const end = [1, 2, 3]
  const idx = ['i', 'j', 'k']

  const res = gpuRuntimeTranspile(arrowFn, localNames, end, idx)
  let found = false
  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('math_max')
    },
    MemberExpression(node: es.MemberExpression) {
      if (
        node.object.type === 'Identifier' &&
        node.object.name === 'Math' &&
        node.property.type === 'Identifier' &&
        node.property.name === 'max'
      ) {
        found = true
      }
    }
  })
  expect(found).toBe(true)
})

test('gpuRuntimeTranspile replaces external identifiers', () => {
  const program = `
    (i, j, k) => {
      const x = math_max(1, y);
      return x;
    }`
  const node = (parse(program, { ecmaVersion: 6 }) as unknown) as es.Program
  const expr = node.body[0] as es.ExpressionStatement
  const arrowFn = expr.expression as es.ArrowFunctionExpression
  const localNames = new Set<string>()
  localNames.add('x')
  const end = [1, 2, 3]
  const idx = ['i', 'j', 'k']

  const res = gpuRuntimeTranspile(arrowFn, localNames, end, idx)
  let found = false
  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('y')
    },
    MemberExpression(node: es.MemberExpression) {
      if (node.property.type === 'Identifier' && node.property.name === 'y') {
        const obj = node.object
        if (
          obj.type === 'MemberExpression' &&
          obj.property.type === 'Identifier' &&
          obj.property.name === 'constants'
        ) {
          found = obj.object.type === 'Identifier' && obj.object.name === 'this'
        }
      }
    }
  })
  expect(found).toBe(true)
})

test.todo('gpuRuntimeTranspile update reference to counters not used as index')
test.todo('gpuRuntimeTranspile update references to counters used as index')
test.todo('gpuRuntimeTranspile update references to counters used as index out of order')
test.todo('gpuRuntimeTranspile update references to counters used as index repeated')
