import type { BinaryOperator, UnaryOperator } from 'estree'
import { describe, expect, test } from 'vitest'

import { Chapter } from '../../langs'
import type { Value } from '../../types'
import * as rttc from '../rttc'
import { mockClosure, mockRuntimeContext } from '../testing/mocks'

const num = 0
const bool = true
const str = ' '
const func = mockClosure()
const builtin = (x: Value) => x
const obj = { a: 1 }
const arr = [2]

const mockValues: Value[] = [num, bool, str, func, builtin, obj, arr, undefined, null]

describe('Unary type combinations:', () => {
  const valid: [UnaryOperator, Value][] = [
    ['!', bool],
    ['+', num],
    ['-', num]
  ]
  const operators: UnaryOperator[] = ['!', '+', '-']
  const invalid: [UnaryOperator, Value][] = []

  operators.forEach(op => {
    mockValues.forEach(value => {
      if (!valid.some(combination => combination[0] === op && combination[1] === value)) {
        invalid.push([op, value])
      }
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([operator, value]: [UnaryOperator, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() => rttc.checkUnaryExpression(node, operator, value)).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, value]: [UnaryOperator, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkUnaryExpression(node, operator, value)
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          operator,
          value,
          explain: error!.explain(),
          elaborate: error!.elaborate()
        }).toMatchSnapshot()
        return
      }
      throw new Error('Expected checkUnaryExpression to throw, did not throw')
    })
  })
})

describe('Binary + type combinations:', () => {
  const valid: [BinaryOperator, Value, Value][] = [
    ['+', num, num],
    ['+', str, str]
  ]
  const operators: BinaryOperator[] = ['+']
  const invalid: [BinaryOperator, Value, Value][] = []

  operators.forEach(op => {
    mockValues.forEach(left => {
      mockValues.forEach(right => {
        if (
          !valid.some(
            combination =>
              combination[0] === op && combination[1] === left && combination[2] === right
          )
        ) {
          invalid.push([op, left, right])
        }
      })
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() =>
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      ).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          operator,
          left,
          right,
          explain: error!.explain(),
          elaborate: error!.elaborate()
        }).toMatchSnapshot()
        return
      }
      throw new Error('Expected checkBinaryExpression to throw, did not throw')
    })
  })
})

describe('Binary (-|*|/|%) type combinations:', () => {
  const valid: [BinaryOperator, Value, Value][] = [
    ['-', num, num],
    ['*', num, num],
    ['/', num, num],
    ['%', num, num]
  ]
  const operators: BinaryOperator[] = ['-', '*', '/', '%']
  const invalid: [BinaryOperator, Value, Value][] = []

  operators.forEach(op => {
    mockValues.forEach(left => {
      mockValues.forEach(right => {
        if (
          !valid.some(
            combination =>
              combination[0] === op && combination[1] === left && combination[2] === right
          )
        ) {
          invalid.push([op, left, right])
        }
      })
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() =>
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      ).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          operator,
          left,
          right,
          explain: error!.explain(),
          elaborate: error!.elaborate()
        }).toMatchSnapshot()
        return
      }
      throw new Error('Expected checkBinaryExpression to throw, did not throw')
    })
  })
})

describe('Binary (===|!==) type combinations:', () => {
  const valid: [BinaryOperator, Value, Value][] = []
  const operators: BinaryOperator[] = ['===', '!==']
  const invalid: [BinaryOperator, Value, Value][] = []

  // Every combination is valid
  operators.forEach(op => {
    mockValues.forEach(left => {
      mockValues.forEach(right => {
        valid.push([op, left, right])
      })
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() =>
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      ).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          operator,
          left,
          right,
          explain: error!.explain(),
          elaborate: error!.elaborate()
        }).toMatchSnapshot()
        return
      }
      throw new Error('Expected checkBinaryExpression to throw, did not throw')
    })
  })
})

describe('Binary (<|>|<=|>=) type combinations:', () => {
  const valid: [BinaryOperator, Value, Value][] = [
    ['<', num, num],
    ['<', str, str],
    ['>', num, num],
    ['>', str, str],
    ['<=', num, num],
    ['<=', str, str],
    ['>=', num, num],
    ['>=', str, str]
  ]
  const operators: BinaryOperator[] = ['<', '>', '<=', '>=']
  const invalid: [BinaryOperator, Value, Value][] = []

  operators.forEach(op => {
    mockValues.forEach(left => {
      mockValues.forEach(right => {
        if (
          !valid.some(
            combination =>
              combination[0] === op && combination[1] === left && combination[2] === right
          )
        ) {
          invalid.push([op, left, right])
        }
      })
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() =>
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      ).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right])
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          operator,
          left,
          right,
          explain: error!.explain(),
          elaborate: error!.elaborate()
        }).toMatchSnapshot()
        return
      }
      throw new Error('Expected checkBinaryExpression to throw error, did not throw error')
    })
  })
})

describe('Ternary/if test expression type combinations:', () => {
  const valid: Value[] = [bool]
  const invalid: Value[] = []

  mockValues.forEach(value => {
    if (!valid.some(combination => combination === value)) {
      invalid.push(value)
    }
  })

  test('Valid type combinations are OK', () => {
    valid.forEach((value: Value) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      expect(() => rttc.checkIfStatement(node, value)).not.toThrow()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach((value: Value) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      try {
        rttc.checkIfStatement(node, value)
      } catch (error) {
        expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
        expect({
          value,
          explain: error.explain(),
          elaborate: error.elaborate()
        }).toMatchSnapshot()
        return
      }

      throw new Error('Expected checkIfStatement to throw, did not get error')
    })
  })
})

describe('Member expression type combinations:', () => {
  const valid: [Value, Value][] = [
    [obj, str],
    [arr, num]
  ]
  const invalid: [Value, Value][] = []

  mockValues.forEach(left => {
    mockValues.forEach(right => {
      if (!valid.some(combination => combination[0] === left && combination[1] === right)) {
        invalid.push([left, right])
      }
    })
  })

  // Extra tests for array indices integral check.
  valid.push([arr, 0])
  valid.push([arr, 10])
  valid.push([arr, 2 ** 32 - 2])
  invalid.push([arr, -1])
  invalid.push([arr, 0.5])
  invalid.push([arr, 2 ** 32 - 1])

  test('Valid type combinations are OK', () => {
    valid.forEach(([left, right]: [Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      const error = rttc.checkMemberAccess(node, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([left, right]: [Value, Value]) => {
      const context = mockRuntimeContext()
      const node = context.runtime.nodes[0]
      const error = rttc.checkMemberAccess(node, left, right)
      expect(error).toBeInstanceOf(rttc.RuntimeTypeError)
      expect({
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})
