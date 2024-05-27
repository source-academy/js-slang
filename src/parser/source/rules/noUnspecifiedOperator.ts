import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'

const nonPermittedBinaryOperators: (es.BinaryOperator | es.LogicalOperator)[] = [
  // '==',
  // '!=',
  // "**",
  '|',
  '^',
  '&',
  'in',
  'instanceof'
  // '??'
]

const permittedBinaryOperators: (es.BinaryOperator | es.LogicalOperator)[] = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '===',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '&&',
  '||'
]

const permittedBinarySnippets = permittedBinaryOperators.map(op => {
  return [`a ${op} b;`, undefined] as [string, undefined]
})

const nonPermittedBinarySnippets = nonPermittedBinaryOperators.map(op => {
  return [`a ${op} b;`, `Operator '${op}' is not allowed.`] as [string, string]
})

// No tests for permitted unary test snippets because typeof operator is a bit more
// complex as to when its permitted
const permittedUnaryOperators: es.UnaryOperator[] = ['-', '!', 'typeof']

// TODO: potentially handle the delete operator separately?
// it gives 'deleting local variable in strict mode' as the error instead of
// non-permitted operator
const nonPermittedUnaryOperators: es.UnaryOperator[] = ['~', '+', 'void']
const nonPermittedUnarySnippets = nonPermittedUnaryOperators.map(
  op => [`${op} a;`, `Operator '${op}' is not allowed.`] as [string, string]
)

export class NoUnspecifiedOperatorError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public unspecifiedOperator: string

  constructor(public node: es.BinaryExpression | es.UnaryExpression | es.LogicalExpression) {
    this.unspecifiedOperator = node.operator
  }

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public elaborate() {
    return ''
  }
}

export class StrictEqualityError implements SourceError {
  public type = ErrorType.SYNTAX;
  public severity = ErrorSeverity.ERROR;

  constructor(public node: es.BinaryExpression) { }

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of ==.'
    } else {
      return 'Use !== instead of !=.'
    }
  }

  public elaborate() {
    return '== and != are not valid operators.'
  }
}

const noUnspecifiedOperator: Rule<es.BinaryExpression | es.UnaryExpression | es.LogicalExpression> =
  {
    name: 'no-unspecified-operator',
    testSnippets: [
      ...permittedBinarySnippets,
      ...nonPermittedBinarySnippets,
      ...nonPermittedUnarySnippets,
      ['const x = 1 == 2;', 'Line 1: Use === instead of ==.'],
      ['const x = 1 != 2;', 'Line 1: Use !== instead of !=.']
    ],

    checkers: {
      BinaryExpression(node: es.BinaryExpression) {
        if (node.operator === '==' || node.operator === '!=') { 
          return [new StrictEqualityError(node)]
        } else if (!permittedBinaryOperators.includes(node.operator)) {
          return [new NoUnspecifiedOperatorError(node)]
        } else {
          return []
        }
      },
      LogicalExpression(node: es.LogicalExpression) {
        if (!permittedBinaryOperators.includes(node.operator)) {
          return [new NoUnspecifiedOperatorError(node)]
        } else {
          return []
        }
      },
      UnaryExpression(node: es.UnaryExpression) {
        if (!permittedUnaryOperators.includes(node.operator)) {
          return [new NoUnspecifiedOperatorError(node)]
        } else {
          return []
        }
      }
    }
  }

export default noUnspecifiedOperator

