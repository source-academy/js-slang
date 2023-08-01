import type { Context } from '../..'
import { UndefinedVariable } from '../../errors/errors'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import checkForUndefinedVariables from '../variableChecker'

type ErrorInfo = {
  name: string
  line: number
  col: number
}

function assertUndefined(code: string, context: Context, errorInfo: ErrorInfo | null) {
  const parsed = parse(code, context, {}, true)!
  // console.log(parsed.type)
  if (errorInfo !== null) {
    let error: any = null
    try {
      checkForUndefinedVariables(parsed, new Set())
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(UndefinedVariable)
    expect(error.name).toEqual(errorInfo.name)
    expect(error.location.start).toMatchObject({
      line: errorInfo.line,
      column: errorInfo.col
    })
  } else {
    expect(() => checkForUndefinedVariables(parsed, new Set())).not.toThrow()
  }
}

function testCases(desc: string, cases: [name: string, code: string, err: null | ErrorInfo][]) {
  const context = mockContext(Chapter.FULL_JS)
  describe(desc, () => {
    test.concurrent.each(cases)('%#. %s', (_, code, expected) =>
      assertUndefined(code, context, expected)
    )
  })
}

describe('Test variable declarations', () => {
  testCases('Test checking variable declarations', [
    [
      'Check single declaration',
      'const x = unknown_var;',
      { name: 'unknown_var', line: 1, col: 10 }
    ],
    [
      'Check multiple declarations',
      'const x = unknown_var, y = unknown_var;',
      { name: 'unknown_var', line: 1, col: 10 }
    ],
    [
      'Check object pattern declaration',
      'const x = { item0: unknown_var };',
      { name: 'unknown_var', line: 1, col: 19 }
    ],
    [
      'Check nested object pattern declaration',
      'const x = { item0: { ...unknown_var } };',
      { name: 'unknown_var', line: 1, col: 24 }
    ],
    [
      'Check array pattern declaration',
      'const [x, y, { z }] = unknown_var;',
      { name: 'unknown_var', line: 1, col: 22 }
    ],
    ['Check let declaration', 'let x; 5+5; x = 0;', null]
  ])

  testCases('Test destructuring variable declarations', [
    ['Check object destructuring', 'const { x: { a, ...b }, c } = {}; a; b; c;', null],
    ['Check array destructuring', 'const [a,,[b ,c], ...d] = []; a; b; c; d;', null]
  ])
})

describe('Test functions', () => {
  testCases('Test function declarations', [
    [
      'Function parameters and name are accounted for',
      'function hi_there(a, b, c, d) { hi_there; a; b; c; d; }',
      null
    ],
    [
      'Destructured parameters are accounted for',
      'function hi_there({a, e: { x: [c], ...d } }, b) { hi_there; a; b; c; d; }',
      null
    ],
    [
      'Function bodies are checked correctly',
      'function hi_there() { unknown_var }',
      { name: 'unknown_var', line: 1, col: 22 }
    ],
    [
      'Identifiers from outside scopes are accounted for',
      'const known = 0; function hi_there() { return known }',
      null
    ]
  ])

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
    [
      'Function bodies are checked correctly',
      'const hi_there = () => { unknown_var }',
      { name: 'unknown_var', line: 1, col: 25 }
    ],
    [
      'Function expression bodies are checked correctly',
      'const hi_there = param => unknown_var && param',
      { name: 'unknown_var', line: 1, col: 26 }
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
    [
      'Function bodies are checked correctly',
      'const hi_there = function () { unknown_var }',
      { name: 'unknown_var', line: 1, col: 31 }
    ]
  ])
})

describe('Test export and import declarations', () => {
  testCases('Test ExportNamedDeclaration', [
    ['Export function declarations are hoisted', 'hi(); export function hi() {}', null],
    [
      'Export function declarations are checked',
      'hi(); export function hi() { unknown_var }',
      { name: 'unknown_var', line: 1, col: 29 }
    ],
    [
      'Non declaration named exports do not introduce identifiers',
      "export { hi } from './elsewhere.js'; hi;",
      { name: 'hi', line: 1, col: 37 }
    ],
    [
      'Non declaration named exports are not considered undefined',
      "export { hi } from './elsewhere.js';",
      null
    ]
  ])

  testCases('Test ExportDefaultDeclaration', [
    ['Export function declarations are hoisted', 'hi(); export default function hi() {}', null],
    [
      'Export function declarations are checked',
      'hi(); export default function hi() { unknown_var }',
      { name: 'unknown_var', line: 1, col: 37 }
    ],
    [
      'Default exports without an id are still checked',
      'export default () => { unknown_var }',
      { name: 'unknown_var', line: 1, col: 23 }
    ]
  ])

  testCases('Test ExportAllDeclaration', [
    [
      'Export does not introduce identifiers',
      "export * as hi from './elsewhere.js'; hi;",
      { name: 'hi', line: 1, col: 38 }
    ],
    ['Exported name is not considered undefined', "export * as hi from 'elsewhere.js';", null]
  ])

  testCases('Test ImportDeclarations', [
    ['ImportSpecifiers are accounted for', 'import { hi } from "one_module"; hi;', null],
    [
      'Aliased ImportSpecifiers are accounted for',
      'import { x as hi } from "one_module"; hi;',
      null
    ],
    ['ImportDefaultSpecifiers are accounted for', 'import hi from "one_module"; hi;', null],
    ['ImportNamespaceSpecifiers are accounted for', 'import * as hi from "one_module"; hi;', null]
  ])
})

testCases('Test block scoping', [
  [
    'BlockStatements are checked properly',
    '{ unknown_var }',
    { name: 'unknown_var', line: 1, col: 2 }
  ],
  [
    'const declarations can be accessed by inner blocks',
    `
    {
      const x = 0;
      {
        x;
      }
    }  
  `,
    null
  ],
  [
    'const declarations can be accessed by nested inner blocks',
    `
    {
      const x = 0;
      {
        {
          {
            x;
          }
        }
      }
    }  
  `,
    null
  ],
  [
    'const declarations cannot be accessed by outer blocks ',
    `
  {
    {
      const x = 0;
    }
    x;
  }
  `,
    { name: 'x', line: 6, col: 4 }
  ],
  [
    'const declarations can shadow outer variables',
    `
  {
    const x = 0;
    {
      const x = 0;
      x;
    }
    x;
  }
  `,
    null
  ],
  [
    'var declarations are accessible to the global scope and hoisted to the top',
    `
    x;
    {
      {
        {
          var x;
        }
      }
    }`,
    null
  ],
  [
    'Function declarations are hoisted to the top of a scope',
    `{
      hi();
      function hi() {}
    }`,
    null
  ],
  [
    'Function declarations are accessible to inner scopes',
    `
    {
      {
        hi;
      }
      function hi() {}
    }`,
    null
  ],
  [
    'Function declarations are not accessible to outer scopes',
    `{
      function hi() {}
    }
    hi;`,
    {
      name: 'hi',
      line: 4,
      col: 4
    }
  ],
  [
    'Imports are hoisted',
    `
    x;
    import { x } from 'one-module';
    `,
    null
  ],
  [
    'Export var declarations are hoisted',
    `
    x;
    export var x = 5;
    `,
    null
  ]
])

describe('Test For Statements', () => {
  testCases('Test regular for statements', [
    ['Init statement properly declares variables', 'for (let i = 0; i < 5; i++) { i; }', null],
    ['Works with expression bodies', 'for (let i = 0; i < 5; i++) i++;', null],
    [
      'Test expression is accounted for',
      'for (let i = 0; unknown_var < 5; i++) { i; }',
      { name: 'unknown_var', line: 1, col: 16 }
    ],
    [
      'Update statement is accounted for',
      'for (let i = 0; i < 5; unknown_var++) { i; }',
      { name: 'unknown_var', line: 1, col: 23 }
    ],
    [
      'Init is scoped to for statement',
      'for (let i = 0; i < 5; i++) {} i; ',
      { name: 'i', line: 1, col: 31 }
    ]
  ])

  testCases('Test for of statements', [
    ['Init statement properly declares variables', 'for (const i of [1,2,3,4]) { i; }', null],
    [
      'Init statement works with patterns',
      'const obj = {}; for (obj.obj of [1,2,3,4]) { obj }',
      null
    ],
    [
      'Init is scoped to statement',
      'for (const x of [1,2,3,4]){} x;',
      { name: 'x', line: 1, col: 29 }
    ]
  ])

  testCases('Test for in statements', [
    ['Init statement properly declares variables', 'for (const i in [1,2,3,4]) { i; }', null],
    [
      'Init statement works with patterns',
      'const obj = {}; for (obj.obj in [1,2,3,4]) { obj }',
      null
    ],
    [
      'Init is scoped to statement',
      'for (const x in [1,2,3,4]){} x;',
      { name: 'x', line: 1, col: 29 }
    ]
  ])
})

testCases('Test assignment expressions', [
  ['Assignment expressions are checked', `a = b`, { line: 1, col: 0, name: 'a' }]
])

testCases('Test MemberExpressions', [
  ['Non computed properties are ignored', 'const obj = {}; obj.hi;', null],
  [
    'Computed properties are checked',
    "const obj = {}; obj[unknown_var] = 'x';",
    { name: 'unknown_var', line: 1, col: 20 }
  ]
])

testCases('Test try statements', [
  ['Catch block parameter is accounted for', 'try {} catch (e) { e; }', null]
])