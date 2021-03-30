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

test('gpuRuntimeTranspile update reference to counters not used as index', () => {
  const program = `
    (i, j, k) => {
      const x = i + j + k;
      return x;
    }`
  const node = (parse(program, { ecmaVersion: 6 }) as unknown) as es.Program
  const expr = node.body[0] as es.ExpressionStatement
  const arrowFn = expr.expression as es.ArrowFunctionExpression
  const localNames = new Set<string>()
  localNames.add('x')
  const end = [1, 2, 3]
  const idx = ['i']

  const res = gpuRuntimeTranspile(arrowFn, localNames, end, idx)
  let found = false
  let checkId = (node: es.Node, id: string) => {
    // this.thread.id
    if (
      node.type === 'MemberExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name === id &&
      node.object.type === 'MemberExpression' &&
      node.object.property.type === 'Identifier' &&
      node.object.property.name === 'thread' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'this'
    ) {
      return true
    } else {
      return false
    }
  }

  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('j')
      expect(node.name).not.toEqual('k')
    },
    BinaryExpression(node: es.BinaryExpression) {
      const left = node.left
      const right = node.right

      if (
        // this.thread.x + 2
        left.type === 'BinaryExpression' &&
        checkId(left.left, 'x') &&
        left.right.type === 'Literal' &&
        left.right.value === 2 &&
        // 3
        right.type === 'Literal' &&
        right.value === 3
      ) {
        found = true
      }
    }
  })
  expect(found).toBe(true)
})

test('gpuRuntimeTranspile update references to counters used as index', () => {
  const program = `
    (i, j, k) => {
      const x = i + j + k;
      return x;
    }`
  const node = (parse(program, { ecmaVersion: 6 }) as unknown) as es.Program
  const expr = node.body[0] as es.ExpressionStatement
  const arrowFn = expr.expression as es.ArrowFunctionExpression
  const localNames = new Set<string>()
  localNames.add('x')
  const end = [1, 2, 3]
  const idx = ['i', 'j']

  const res = gpuRuntimeTranspile(arrowFn, localNames, end, idx)
  let found = false
  let checkId = (node: es.Node, id: string) => {
    // this.thread.id
    if (
      node.type === 'MemberExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name === id &&
      node.object.type === 'MemberExpression' &&
      node.object.property.type === 'Identifier' &&
      node.object.property.name === 'thread' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'this'
    ) {
      return true
    } else {
      return false
    }
  }

  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('i')
      expect(node.name).not.toEqual('j')
      expect(node.name).not.toEqual('k')
    },
    BinaryExpression(node: es.BinaryExpression) {
      const left = node.left
      const right = node.right

      if (
        // this.thread.y + this.thread.x + 3
        left.type === 'BinaryExpression' &&
        checkId(left.left, 'y') &&
        checkId(left.right, 'x') &&
        right.type === 'Literal' &&
        right.value === 3
      ) {
        found = true
      }
    }
  })
  expect(found).toBe(true)
})

test('gpuRuntimeTranspile update references to counters used as index out of order', () => {
  const program = `
    (i, j, k) => {
      const x = i + j + k;
      return x;
    }`
  const node = (parse(program, { ecmaVersion: 6 }) as unknown) as es.Program
  const expr = node.body[0] as es.ExpressionStatement
  const arrowFn = expr.expression as es.ArrowFunctionExpression
  const localNames = new Set<string>()
  localNames.add('x')
  const end = [1, 2, 3]
  const idx = ['j', 1, 'k', 'i']

  const res = gpuRuntimeTranspile(arrowFn, localNames, end, idx)
  let found = false
  let checkId = (node: es.Node, id: string) => {
    // this.thread.id
    if (
      node.type === 'MemberExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name === id &&
      node.object.type === 'MemberExpression' &&
      node.object.property.type === 'Identifier' &&
      node.object.property.name === 'thread' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'this'
    ) {
      return true
    } else {
      return false
    }
  }

  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('i')
      expect(node.name).not.toEqual('j')
      expect(node.name).not.toEqual('k')
    },
    BinaryExpression(node: es.BinaryExpression) {
      const left = node.left
      const right = node.right

      if (
        // this.thread.x + this.thread.z + this.thread.y
        left.type === 'BinaryExpression' &&
        checkId(left.left, 'x') &&
        checkId(left.right, 'z') &&
        checkId(right, 'y')
      ) {
        found = true
      }
    }
  })
  expect(found).toBe(true)
})

test('gpuRuntimeTranspile update references to counters used as index repeated', () => {
  const program = `
    (i, j, k) => {
      const x = i + j + i;
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
  let checkId = (node: es.Node, id: string) => {
    // this.thread.id
    if (
      node.type === 'MemberExpression' &&
      node.property.type === 'Identifier' &&
      node.property.name === id &&
      node.object.type === 'MemberExpression' &&
      node.object.property.type === 'Identifier' &&
      node.object.property.name === 'thread' &&
      node.object.object.type === 'Identifier' &&
      node.object.object.name === 'this'
    ) {
      return true
    } else {
      return false
    }
  }

  simple(res, {
    Identifier(node: es.Identifier) {
      expect(node.name).not.toEqual('i')
      expect(node.name).not.toEqual('j')
      expect(node.name).not.toEqual('k')
    },
    BinaryExpression(node: es.BinaryExpression) {
      const left = node.left
      const right = node.right

      if (
        // this.thread.z + this.thread.y + this.thread.z
        left.type === 'BinaryExpression' &&
        checkId(left.left, 'z') &&
        checkId(left.right, 'y') &&
        checkId(right, 'z')
      ) {
        found = true
      }
    }
  })
  expect(found).toBe(true)
})
