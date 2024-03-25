import { pick } from 'lodash'
import { createContext } from '../..'
import { getNames } from '../../index'
import { Chapter } from '../../types'
import { DeclarationKind, type NameDeclaration } from '../index'

jest.mock('../../modules/loader/moduleLoaderAsync')

function matchExpectedNames(
  extractedNames: NameDeclaration[],
  expectedNames: NameDeclaration[],
  unexpectedNames: NameDeclaration[]
) {
  for (const expectedName of expectedNames) {
    expect(extractedNames).toContainEqual(expectedName)
  }

  for (const unexpectedName of unexpectedNames) {
    expect(extractedNames).not.toContainEqual(unexpectedName)
  }
}

/**
 * Regular Test Case: No unexpected names
 */
type TestCaseWithoutUnexpectedNames = [
  description: string,
  code: string,
  line: number,
  col: number,
  expectedNames: NameDeclaration[]
]

/**
 * If there are names that should not be returned that we want to explicitly
 * test for, provide an array of those declarations
 */
type TestCaseWithUnexpectedNames = [...TestCaseWithoutUnexpectedNames, NameDeclaration[]]

/**
 * For test cases that require a specific context, provide the chapter number
 */
type TestCaseWithChapter = [...TestCaseWithUnexpectedNames, Chapter]
type TestCase = TestCaseWithUnexpectedNames | TestCaseWithoutUnexpectedNames | TestCaseWithChapter

const testCases: TestCase[] = [
  [`Test empty program does not generate names`, `f`, 1, 1, []],
  [
    'Test simple extraction of function names',
    `
    function foo1() 
      return true;
    }
    function foo2() {
      return true;
    }
    f
    `,
    7,
    1,
    [
      { name: 'foo2', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 0 }
    ]
  ],
  [
    'Test that names in smaller scope are not extracted',
    `
      function baz1() {
        let bar1 = 1;
      }
      function baz2() {
        let bar2 = 1;
      }
      f
    `,
    7,
    1,
    [
      { name: 'baz2', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'baz1', meta: DeclarationKind.KIND_FUNCTION, score: 0 }
    ],
    [
      { name: 'bar1', meta: DeclarationKind.KIND_LET },
      { name: 'bar2', meta: DeclarationKind.KIND_LET }
    ]
  ],
  [
    'Test that names in larger scope are extracted',
    `
    let bar1 = 1;
    function foo1() {
      let bar3 = 1;
      function foo2() {
        b
      }
      const bar2 = 1;
      function bar4() {
        const baz = 1;
      }
    }
    `,
    5,
    3,
    [
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'bar4', meta: DeclarationKind.KIND_FUNCTION, score: 5 },
      { name: 'bar2', meta: DeclarationKind.KIND_CONST, score: 4 },
      { name: 'foo2', meta: DeclarationKind.KIND_FUNCTION, score: 3 },
      { name: 'bar3', meta: DeclarationKind.KIND_LET, score: 2 },
      { name: 'bar1', meta: DeclarationKind.KIND_LET, score: 0 }
    ],
    [{ name: 'baz', meta: DeclarationKind.KIND_CONST }]
  ],
  [
    'Test nested global scope',
    `
      let bar = 1;
      function foo1() {
        function foo2() {
          function foo3() {
            b
        }
      }
    `,
    5,
    2,
    [
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'foo2', meta: DeclarationKind.KIND_FUNCTION, score: 2 },
      { name: 'foo3', meta: DeclarationKind.KIND_FUNCTION, score: 3 },
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  // Function declarations
  [
    'Test that local and global variables are available in function declaration',
    `
    let bar1 = 1;
    function foo1(){
      let bar2 = 2;
      function foo2() {
      }
    }
    `,
    4,
    26,
    [
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'foo2', meta: DeclarationKind.KIND_FUNCTION, score: 3 },
      { name: 'bar2', meta: DeclarationKind.KIND_LET, score: 2 },
      { name: 'bar1', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  [
    'Test accessing parameter names inside function',
    '\
      function foo1(bar1, baz1) {\n\
        b\n\
      }\n\
      function foo2(bar2) {\n\
        b\n\
      }\n\
    ',
    2,
    3,
    [
      { name: 'foo2', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 0 },
      { name: 'bar1', meta: DeclarationKind.KIND_PARAM, score: 2 },
      { name: 'baz1', meta: DeclarationKind.KIND_PARAM, score: 3 }
    ],
    [{ name: 'baz2', meta: DeclarationKind.KIND_CONST }]
  ],
  // For loops
  [
    'Test accessing local block in for-loop parameter',
    `
    let bar = 1;
    let baz = 2;
    for (b) {
    `,
    3,
    6,
    [
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 1 },
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  [
    'Test accessing for-loop parameter in for-loop body',
    '\
      for (let foo=10;) {\n\
        f\n\
      }\
    ',
    2,
    3,
    [{ name: 'foo', meta: DeclarationKind.KIND_LET, score: 0 }]
  ],
  [
    'Test that for-loop local variable cannot be accessed outside loop',
    `
    for (let x=1; x<10; x=x+1) {
      let foo = x;
    }
    f
    `,
    4,
    1,
    []
  ],
  [
    'Test accessing local block in while-loop parameter',
    `
    let bar = 1;
    let baz = 2;
    while (b) {
    `,
    3,
    6,
    [
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 1 },
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  [
    'Test that while-loop local variable cannot be accessed outside loop',
    `
    while (let x=1; x<10; x=x+1) {
      let foo = x;
    }
    f
   `,
    4,
    1,
    []
  ],
  [
    'Test accessing local block in if-else parameter',
    `
    let bar = 1;
    let baz = 2;
    if (b) {
    `,
    3,
    5,
    [
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 1 },
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  [
    'Test that local variable in if-block cannot be accessed in else-block',
    `
    if (true) {
      let foo = x;
    } else {
      f
    }
    `,
    4,
    1,
    []
  ],
  [
    'Test that variable in if- and else- cannot be accessed outside either block',
    `
    if (true) {
      let foo = 2;
    } else {
      let foo = 1;
    }
    f
    `,
    6,
    1,
    []
  ],
  [
    'Test that variable in if cannot be accessed outside if-statement',
    `
    function foo(baz) {
      if (baz) {
        let bar = 1;
      }
      b
    }
    `,
    5,
    2,
    [
      { name: 'foo', meta: DeclarationKind.KIND_FUNCTION, score: 0 },
      { name: 'baz', meta: DeclarationKind.KIND_PARAM, score: 1 }
    ]
  ],
  // Blocks
  [
    'Test that declaration in blocks cannot be accessed outside block',
    `
    {
      let foo = 1;
    }
    f
    `,
    4,
    1,
    []
  ],
  [
    'Test that declaration outside blocks can be accessed inside block',
    `
    let bar = 1;
    {
      let baz = 1;
      b
    }
    `,
    4,
    2,
    [
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 1 },
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 0 }
    ]
  ],
  // Anonymous functions
  [
    'Test that declaration outside of anonymous functions can be accessed inside',
    `
    let foo = () => { 
      let baz = 1;
      b
    }
    let bar = 3;
    `,
    4,
    1,
    [
      { name: 'bar', meta: DeclarationKind.KIND_LET, score: 1 },
      { name: 'foo', meta: DeclarationKind.KIND_LET, score: 0 },
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 2 }
    ]
  ],
  [
    'Test that declaration inside anonymous functions can be accessed in body',
    `
    let foo = (bar1, bar2) => { \n\
      let baz = 1;\n\
      b\n\
    }\n\
    `,
    3,
    2,
    [
      { name: 'foo', meta: DeclarationKind.KIND_LET, score: 0 },
      { name: 'bar1', meta: DeclarationKind.KIND_PARAM, score: 1 },
      { name: 'bar2', meta: DeclarationKind.KIND_PARAM, score: 2 },
      { name: 'baz', meta: DeclarationKind.KIND_LET, score: 3 }
    ]
  ],
  [
    'Test that declaration inside anonymous functions cannot be accessed outside',
    `
    let foo = (bar1, bar2) => { 
      let baz = 1;
    }
    b
    `,
    4,
    1,
    [{ name: 'foo', meta: DeclarationKind.KIND_LET, score: 0 }]
  ],
  // Return statements
  [
    'Test that local and global variables are available in return statements',
    `
    let bar1 = 1;
    function foo1(){
      let bar2 = 2;
      return b
    }
    `,
    4,
    7,
    [
      { name: 'foo1', meta: DeclarationKind.KIND_FUNCTION, score: 1 },
      { name: 'bar2', meta: DeclarationKind.KIND_LET, score: 2 }
    ]
  ],
  // Declarations
  [
    'Test that no prompts are returned when user is declaring variable',
    `
    let bar = 1;
    let b
    `,
    2,
    9,
    []
  ],
  // Builtins
  [
    'Test that builtins are prompted',
    'w',
    1,
    1,
    [
      { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'let', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'while', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'for', meta: DeclarationKind.KIND_KEYWORD, score: 20000 }
    ],
    [],
    Chapter.SOURCE_4
  ],
  [
    'Test that unavailable builtins are not prompted',
    'w',
    1,
    1,
    [
      { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: 20000 }
    ],
    [],
    Chapter.SOURCE_1
  ],
  [
    'Test keywords in function',
    'function foo() {r}',
    1,
    17,
    [
      { name: 'foo', meta: DeclarationKind.KIND_FUNCTION, score: 0 },
      { name: 'return', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'let', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'while', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'for', meta: DeclarationKind.KIND_KEYWORD, score: 20000 }
    ],
    [],
    Chapter.SOURCE_4
  ],
  [
    'Test keywords in while loop',
    'while (true) {r}',
    1,
    15,
    [
      { name: 'break', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'continue', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'let', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'while', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'for', meta: DeclarationKind.KIND_KEYWORD, score: 20000 }
    ],
    [],
    Chapter.SOURCE_4
  ],
  [
    'Test keywords in for loop',
    'for(;;){r}',
    1,
    9,
    [
      { name: 'break', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'continue', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'let', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'while', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: 20000 },
      { name: 'for', meta: DeclarationKind.KIND_KEYWORD, score: 20000 }
    ],
    [],
    Chapter.SOURCE_4
  ],
  // Import Declarations
  [
    'Names from import declarations should be suggested, if there are any',
    `
    import { foo } from 'one_module';
    f
    `,
    2,
    1,
    [{ name: 'foo', meta: DeclarationKind.KIND_IMPORT, score: 0 }]
  ]
]

test.each(
  testCases.map(tc => {
    // Fill in default values, [] for unexpected names if none were provided
    // 0 as chapter value if none was provided
    switch (tc.length) {
      case 5:
        return [...tc, [], 0 as any]
      case 6:
        return [...tc, 0 as any]
      case 7:
        return tc
    }
  })
)('%#. %s', async (_, code, line, col, expectedNames, unexpectedNames, chapter) => {
  const context = createContext(chapter)
  const [extractedNames] = await getNames(code, line, col, context)

  // Sometimes the declarations come with extra properties that we don't need to
  // compare, so we only pick the ones that we want to compare
  const sanitized = extractedNames.map(each => pick(each, 'name', 'meta', 'score'))
  matchExpectedNames(sanitized, expectedNames, unexpectedNames)
})
