import type es from 'estree'

import { generate } from 'astring'
import { RuleError, type Rule } from '../../types'
import type { SourceError } from '../../../types'

type OperatorNodeTypes =
  | es.BinaryExpression
  | es.UnaryExpression
  | es.LogicalExpression
  | es.AssignmentExpression

type OperatorRecord<T extends OperatorNodeTypes> = {
  /**
   * Array of allowed operators
   */
  allowed: T['operator'][]

  /**
   * Array of disallowed operators
   */
  disallowed: T['operator'][]

  /**
   * Function used to map allowed operators to test snippets
   */
  allowedSnippetMapper: (ops: T['operator'][]) => string

  /**
   * Function used to map disallowed operators to test snippets
   */
  disallowedSnippetMapper: (ops: T['operator'][]) => [string, string]

  /**
   * Checking function to use with the given node type
   */
  checker: (node: T, ancestors: Node[]) => SourceError[]
}

type OperatorClassifications = {
  [K in OperatorNodeTypes['type']]: OperatorRecord<Extract<OperatorNodeTypes, { type: K }>>
}

const disallowedBinaryOperators: es.BinaryOperator[] = [
  // '==',
  // '!=',
  // "**",
  '|',
  '^',
  '&',
  'in',
  'instanceof',
  // '??',
  '>>',
  '<<',
  '>>>'
]

const operators: OperatorClassifications = {
  AssignmentExpression: {
    allowed: ['='],
    disallowed: [
      // Some operators aren't recognized as valid operators
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
      // "**=",
      '<<=',
      '>>=',
      '>>>=',
      '|=',
      '^=',
      '&='
      // "||=",
      // "&&=",
      // "??="
    ],
    allowedSnippetMapper: op => `a ${op} b`,
    disallowedSnippetMapper: op => [
      `a ${op} b;`,
      `Line 1: The assignment operator ${op} is not allowed. Use = instead.`
    ],
    checker(node) {
      if (node.operator !== '=') return [new NoUpdateAssignment(node)]

      const op = node.operator.slice(0, -1) as es.BinaryOperator
      if (disallowedBinaryOperators.includes(op)) {
        return [new NoUnspecifiedOperatorError(node)]
      }

      return []
    }
  },
  BinaryExpression: {
    disallowed: disallowedBinaryOperators,
    allowed: ['+', '-', '*', '/', '%', '===', '!==', '<', '>', '<=', '>='],
    allowedSnippetMapper: op => `a ${op} b;`,
    disallowedSnippetMapper: op => [`a ${op} b;`, `Operator '${op}' is not allowed.`],
    checker(node) {
      if (node.operator === '==' || node.operator === '!=') {
        return [new StrictEqualityError(node)]
      } else if (this.disallowed.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      }

      return []
    }
  },
  LogicalExpression: {
    allowed: ['||', '&&'],
    disallowed: ['??'],
    allowedSnippetMapper: op => `a ${op} b;`,
    disallowedSnippetMapper: op => [`a ${op} b;`, `Operator '${op}' is not allowed.`],
    checker(node) {
      if (this.disallowed.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      } else {
        return []
      }
    }
  },
  UnaryExpression: {
    allowed: ['-', '!', 'typeof'],
    disallowed: ['~', '+', 'void'],
    allowedSnippetMapper: op => `${op} a;`,
    disallowedSnippetMapper: op => [`${op} a;`, `Operator '${op}' is not allowed.`],
    checker(node) {
      if (this.disallowed.includes(node.operator)) {
        return [new NoUnspecifiedOperatorError(node)]
      }
      return []
    }
  }
}

export class NoUnspecifiedOperatorError<T extends OperatorNodeTypes = OperatorNodeTypes> extends RuleError<T> {
  public unspecifiedOperator: T['operator']

  constructor(node: T) {
    super(node)
    this.unspecifiedOperator = node.operator
  }

  public explain() {
    return `Operator '${this.unspecifiedOperator}' is not allowed.`
  }

  public elaborate() {
    return ''
  }
}

export class NoUpdateAssignment extends NoUnspecifiedOperatorError<es.AssignmentExpression> {
  public override explain() {
    return `The assignment operator ${this.node.operator} is not allowed. Use = instead.`
  }

  public override elaborate() {
    const leftStr = generate(this.node.left)
    const rightStr = generate(this.node.right)
    const opStr = this.node.operator.slice(0, -1)

    return `\n\t${leftStr} = ${leftStr} ${opStr} ${rightStr};`
  }
}

export class StrictEqualityError extends NoUnspecifiedOperatorError<es.BinaryExpression> {
  public override explain() {
    if (this.node.operator === '==') {
      return 'Use === instead of ==.'
    } else {
      return 'Use !== instead of !=.'
    }
  }

  public override elaborate() {
    return '== and != are not valid operators.'
  }
}

const noUnspecifiedOperator = Object.entries(operators).reduce(
  (
    res,
    [nodeType, { checker, allowed, disallowed, allowedSnippetMapper, disallowedSnippetMapper }]
  ) => {
    const allowedSnippets = allowed.map(each => {
      // type intersection gets narrowed down to never, so we manually suppress the ts error
      // @ts-expect-error 2345
      return [allowedSnippetMapper(each), undefined] as [string, undefined]
    })

    // @ts-expect-error 2345
    const disallowedSnippets = disallowed.map(disallowedSnippetMapper)

    return {
      ...res,
      testSnippets: [
        ...res.testSnippets!,
        ...disallowedSnippets,
        ...allowedSnippets
      ],
      checkers: {
        ...res.checkers,
        [nodeType]: checker
      }
    }
  },
  {
    name: 'no-unspecified-operator',
    testSnippets: [
      ['a == b', 'Line 1: Use === instead of =='],
      ['a != b', 'Line 1: Use !== instead of !='],
    ],
    checkers: {}
  } as Rule<OperatorNodeTypes>
)

export default noUnspecifiedOperator
