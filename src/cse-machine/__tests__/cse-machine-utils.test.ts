import { parse } from "acorn"
import type { BlockStatement } from "estree"
import { describe, expect, test } from 'vitest'
import { ACORN_PARSE_OPTIONS } from "../../constants"
import { hasBreakStatement, hasContinueStatement, hasReturnStatement } from "../utils"

type TestCase = [
  desc: string,
  code: string,
  expected: boolean
]

describe(hasBreakStatement, () => {
  // If statements
  const ifCases: TestCase[] = [
    [
      'If statement without alternative',
      'if (true) { break; }',
      true
    ],
    [
      'If statement with alternative',
      'if (true) { break; } else { break; }',
      true
    ],
    [
      'If statement with alternative missing break',
      'if (true) { break; } else { }',
      true
    ],
    [
      'If statement with consequent missing break',
      'if (true) { } else { break; }',
      true
    ],
    [
      'If statement with both missing break',
      'if (true) { } else { }',
      false
    ],
    [
      'If statement with consequent only and missing break',
      'if (true) { }',
      false
    ]
  ]

  const blockCases: TestCase[] = [
    [
      'Simple block',
      'break',
      true
    ],
    [
      'Nested block',
      '{ break }',
      true
    ],
    ...ifCases.map(([desc, code, expected]): [string, string, boolean] => [
      `${desc} inside block`,
      `{
        ${code}
      }`,
      expected
    ])
  ]

  test.each([
    ...ifCases,
    ...blockCases
  ])('%#. %s', (_, code, expected) => {
    const parsed = parse(`while (true) {
      ${code}  
    }`, ACORN_PARSE_OPTIONS)
    
    const { body: [statement] } = parsed

    if (statement.type !== 'WhileStatement' || statement.body.type !== 'BlockStatement') throw new Error();
    expect(hasBreakStatement(statement.body as BlockStatement)).toEqual(expected)
  })
})

describe(hasContinueStatement, () => {
  // If statements
  const ifCases: TestCase[] = [
    [
      'If statement without alternative',
      'if (true) { continue; }',
      true
    ],
    [
      'If statement with alternative',
      'if (true) { continue; } else { continue; }',
      true
    ],
    [
      'If statement with alternative missing continue',
      'if (true) { continue; } else { }',
      true
    ],
    [
      'If statement with consequent missing continue',
      'if (true) { } else { continue; }',
      true
    ],
    [
      'If statement with both missing continue',
      'if (true) { } else { }',
      false
    ],
    [
      'If statement with consequent only and missing continue',
      'if (true) { }',
      false
    ],
  ]

  const blockCases: TestCase[] = [
    [
      'Simple block',
      'continue',
      true
    ],
    [
      'Nested block',
      '{ continue }',
      true
    ],
    ...ifCases.map(([desc, code, expected]): [string, string, boolean] => [
      `${desc} inside block`,
      `{
        ${code}
      }`,
      expected
    ])
  ]

  test.each([
    ...ifCases,
    ...blockCases,
    [
      'Complex case',
      `
        if (true) {
        } else {
          if (false) {
            continue;
          }
        }
      `,
      true
    ]
  ])('%#. %s', (_, code, expected) => {
    const parsed = parse(`while (true) {
      ${code}  
    }`, ACORN_PARSE_OPTIONS)
    
    const { body: [statement] } = parsed

    if (statement.type !== 'WhileStatement' || statement.body.type !== 'BlockStatement') throw new Error();
    expect(hasContinueStatement(statement.body as BlockStatement)).toEqual(expected)
  })
})

describe(hasReturnStatement, () => {
  const ifCases: TestCase[] = [
    [
      'If with only consequent and no returns',
      'if (true) {}',
      false
    ],
    [
      'If with only consequent and single return',
      'if (true) { return }',
      true
    ],
    [
      'If consequent and alternative have no returns',
      'if (true) {} else {}',
      false
    ],
    [
      'If consequent has return, alternative has no return',
      'if (true) { return } else {}',
      false
    ],
    [
      'If consequent no return, alternate has return',
      'if (true) {} else { return }',
      false
    ],
    [
      'If consequent and alternative with returns',
      'if (true) { return } else { return }',
      true
    ]
  ]

  test.each([
    ...ifCases,
    // ...blockCases
  ])('%#. %s', (_, code, expected) => {
    const parsed = parse(`function tester() {
      ${code}  
    }`, ACORN_PARSE_OPTIONS)
    
    const { body: [statement] } = parsed

    if (statement.type !== 'FunctionDeclaration') throw new Error();
    expect(hasReturnStatement(statement.body as BlockStatement)).toEqual(expected)
  })
})