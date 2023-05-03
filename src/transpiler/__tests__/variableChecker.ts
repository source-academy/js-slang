import type { Context } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import checkForUndefinedVariables from '../variableChecker'

function assertUndefined(code: string, context: Context, message: string | null) {
  const parsed = parse(code, context, {}, true)!
  // console.log(parsed.type)
  if (message !== null) {
    expect(() => checkForUndefinedVariables(parsed, new Set())).toThrowError(message)
  } else {
    expect(() => checkForUndefinedVariables(parsed, new Set())).not.toThrow()
  }
}

function testCases(desc: string, cases: [name: string, code: string, err: null | string][]) {
  const context = mockContext(Chapter.FULL_JS)
  describe(desc, () => {
    test.concurrent.each(cases)('%#. %s', (_, code, expected) =>
      assertUndefined(code, context, expected)
    )
  })
}

describe('Test variable declarations', () => {
  testCases('Test checking variable declarations', [
    ['Check single declaration', 'const x = unknown_var;', ''],
    ['Check multiple declarations', 'const x = unknown_var, y = unknown_var;', ''],
    ['Check object pattern declaration', 'const x = { item0: unknown_var };', ''],
    ['Check nested object pattern declaration', 'const x = { item0: { ...unknown_var } };', ''],
    ['Check array pattern declaration', 'const [x, y, { z }] = unknown_var;', ''],
    ['Check let declaration', 'let x; 5+5; x = 0;', null]
  ])

  testCases('Test destructuring variable declarations', [
    ['Check object destructuring', 'const { x: { a, ...b }, c } = {}; a; b; c;', null],
    ['Check array destructuring', 'const [a,,[b ,c], ...d] = []; a; b; c; d;', null]
  ])
})

describe('Test functions', () => {
  describe('Test function declarations', () => {
    testCases('Check that function declarations are hoisted', [
      ['Account for functions within the same scope', 'a(); function a() {}', null],
      [
        'Account for functions within different scopes',
        'a(); function a() { b(); function b() { c(); } } function c() {}',
        null
      ],
      [
        'Declarations should not be accessible from outer scopes',
        'function a() { function b() { } } b()',
        ''
      ]
    ])

    testCases('Test undefined variable checking', [
      [
        'Function parameters are accounted for',
        'function hi_there(a, b, c, d) { hi_there; a; b; c; d; }',
        null
      ],
      [
        'Destructured parameters are accounted for',
        'function hi_there({a, e: { x: [c], ...d } }, b) { hi_there; a; b; c; d; }',
        null
      ],
      ['Function bodies are checked correctly', 'function hi_there() { unknown_var }', ''],
      [
        'Identifiers from outside scopes are accounted for',
        'const known = 0; function hi_there() { return known }',
        null
      ]
    ])
  })

  testCases('Test arrow function expressions', [
    [
      'Function parameters are accounted for',
      'const hi_there = (a, b, c, d) => { hi_there; a; b; c; d; }',
      null
    ],
    [
      'Destructured parameters are accounted for',
      'const hi_there = ({a, e: { x: [c], ...d } }, b) => { hi_there; a; b; c; d; }',
      null
    ],
    ['Function bodies are checked correctly', 'const hi_there = () => { unknown_var }', ''],
    [
      'Function expression bodies are checked correctly',
      'const hi_there = param => unknown_var && param',
      ''
    ]
  ])

  testCases('Test function expressions', [
    [
      'Function parameters are accounted for',
      'const hi_there = function (a, b, c, d) { hi_there; a; b; c; d; }',
      null
    ],
    [
      'Destructured parameters are accounted for',
      'const hi_there = function ({a, e: { x: [c], ...d } }, b) { hi_there; a; b; c; d; }',
      null
    ],
    ['Function bodies are checked correctly', 'const hi_there = function () { unknown_var }', '']
  ])
})

describe('Test export and import declarations', () => {
  testCases('Test ExportNamedDeclaration', [
    ['Export function declarations are hoisted', 'hi(); export function hi() {}', null],
    ['Export function declarations are checked', 'hi(); export function hi() { unknown_var }', '']
  ])
})
