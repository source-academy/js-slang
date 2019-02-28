import { BinaryOperator, UnaryOperator } from 'estree'
import { mockClosure, mockRuntimeContext } from '../../mocks/context'
import { Value } from '../../types'
import * as rttc from '../rttc'

const num = 0
const bool = true
const str = ' '
const func = mockClosure()
const builtin = (x: Value) => x
const obj = { a: 1 }
const arr = [2]

const mockValues: Value[] = [num, bool, str, func, builtin, obj, arr, undefined, null]

describe('Unary type combinations:', () => {
  const valid: Array<[UnaryOperator, Value]> = [['!', bool], ['+', num], ['-', num]]
  const operators: UnaryOperator[] = ['!', '+', '-']
  const invalid: Array<[UnaryOperator, Value]> = []

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
      const error = rttc.checkUnaryExpression(context, operator, value)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, value]: [UnaryOperator, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkUnaryExpression(context, operator, value)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        operator,
        value,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})

describe('Binary + type combinations:', () => {
  const valid: Array<[BinaryOperator, Value, Value]> = [['+', num, num], ['+', str, str]]
  const operators: BinaryOperator[] = ['+']
  const invalid: Array<[BinaryOperator, Value, Value]> = []

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
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        operator,
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})

describe('Binary (-|*|/|%) type combinations:', () => {
  const valid: Array<[BinaryOperator, Value, Value]> = [
    ['-', num, num],
    ['*', num, num],
    ['/', num, num],
    ['%', num, num]
  ]
  const operators: BinaryOperator[] = ['-', '*', '/', '%']
  const invalid: Array<[BinaryOperator, Value, Value]> = []

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
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        operator,
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})

describe('Binary (===|!==) type combinations:', () => {
  const valid: Array<[BinaryOperator, Value, Value]> = []
  const operators: BinaryOperator[] = ['===', '!==']
  const invalid: Array<[BinaryOperator, Value, Value]> = []

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
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        operator,
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})

describe('Binary (<|>|<=|>=) type combinations:', () => {
  const valid: Array<[BinaryOperator, Value, Value]> = [
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
  const invalid: Array<[BinaryOperator, Value, Value]> = []

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
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([operator, left, right]: [BinaryOperator, Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkBinaryExpression(context, operator, left, right)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        operator,
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
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
      const error = rttc.checkIfStatement(context, value)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach((value: Value) => {
      const context = mockRuntimeContext()
      const error = rttc.checkIfStatement(context, value)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        value,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})

describe('Member expression type combinations:', () => {
  const valid: Array<[Value, Value]> = [[obj, str], [arr, num]]
  const invalid: Array<[Value, Value]> = []

  mockValues.forEach(left => {
    mockValues.forEach(right => {
      if (!valid.some(combination => combination[0] === left && combination[1] === right)) {
        invalid.push([left, right])
      }
    })
  })

  test('Valid type combinations are OK', () => {
    valid.forEach(([left, right]: [Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkMemberAccess(context, left, right)
      expect(error).toBeUndefined()
    })
  })

  test('Invalid type combinations return TypeError', () => {
    invalid.forEach(([left, right]: [Value, Value]) => {
      const context = mockRuntimeContext()
      const error = rttc.checkMemberAccess(context, left, right)
      expect(error).toBeInstanceOf(rttc.TypeError)
      expect({
        left,
        right,
        explain: error!.explain(),
        elaborate: error!.elaborate()
      }).toMatchSnapshot()
    })
  })
})
