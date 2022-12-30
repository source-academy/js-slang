import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { removeExports, transformImportedFile } from '../transformers'
import { stripLocationInfo } from './utils'

describe('transformImportedFile', () => {
  const iifeIdentifier = 'importedFile'
  const parseError = new Error('Unable to parse code')
  let actualContext = mockContext(Chapter.SOURCE_2)
  let expectedContext = mockContext(Chapter.SOURCE_2)

  beforeEach(() => {
    actualContext = mockContext(Chapter.SOURCE_2)
    expectedContext = mockContext(Chapter.SOURCE_2)
  })

  const assertASTsAreEquivalent = (actualCode: string, expectedCode: string): void => {
    const actualProgram = parse(actualCode, actualContext)
    const expectedProgram = parse(expectedCode, expectedContext)
    if (actualProgram === undefined || expectedProgram === undefined) {
      throw parseError
    }

    const actualFunctionDeclaration = transformImportedFile(actualProgram, iifeIdentifier)
    const expectedFunctionDeclaration = expectedProgram.body[0]
    expect(expectedFunctionDeclaration.type).toEqual('FunctionDeclaration')
    expect(stripLocationInfo(actualFunctionDeclaration)).toEqual(
      stripLocationInfo(expectedFunctionDeclaration)
    )
  }

  it('wraps the program body in a FunctionDeclaration', () => {
    const actualCode = `const square = x => x * x;
      const x = 42;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const square = x => x * x;
        const x = 42;
        return pair(null, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns only exported variables', () => {
    const actualCode = `const x = 42;
      export const y = 53;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        const y = 53;
        return pair(null, list(pair("y", y)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns only exported functions', () => {
    const actualCode = `function id(x) {
        return x;
      }
      export function square(x) {
        return x * x;
      }
    `
    const expectedCode = `function ${iifeIdentifier}() {
        function id(x) {
          return x;
        }
        function square(x) {
          return x * x;
        }
        return pair(null, list(pair("square", square)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns only exported arrow functions', () => {
    const actualCode = `const id = x => x;
      export const square = x => x * x;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const id = x => x;
        const square = x => x * x;
        return pair(null, list(pair("square", square)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns all exported names when there are multiple', () => {
    const actualCode = `export const x = 42;
      export function id(x) {
        return x;
      }
      export const square = x => x * x;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        function id(x) {
          return x;
        }
        const square = x => x * x;
        return pair(null, list(pair("x", x), pair("id", id), pair("square", square)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns all exported names in {}-notation', () => {
    const actualCode = `const x = 42;
      function id(x) {
        return x;
      }
      const square = x => x * x;
      export { x, id, square };
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        function id(x) {
          return x;
        }
        const square = x => x * x;
        return pair(null, list(pair("x", x), pair("id", id), pair("square", square)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns renamed exported names', () => {
    const actualCode = `const x = 42;
      function id(x) {
        return x;
      }
      const square = x => x * x;
      export { x as y, id as identity, square as sq };
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        function id(x) {
          return x;
        }
        const square = x => x * x;
        return pair(null, list(pair("y", x), pair("identity", id), pair("sq", square)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  // Default exports of variable declarations and arrow function declarations
  // is not allowed in ES6, and will be caught by the Acorn parser.
  it('returns default export of function declaration', () => {
    const actualCode = `function id(x) {
        return x;
      }
      export default function square(x) {
        return x * x;
      }
    `
    const expectedCode = `function ${iifeIdentifier}() {
        function id(x) {
          return x;
        }
        function square(x) {
          return x * x;
        }
        return pair(square, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of variable', () => {
    const actualCode = `const x = 42;
      const y = 53;
      export default y;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        const y = 53;
        return pair(y, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of function', () => {
    const actualCode = `function id(x) {
        return x;
      }
      function square(x) {
        return x * x;
      }
      export default square;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        function id(x) {
          return x;
        }
        function square(x) {
          return x * x;
        }
        return pair(square, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of arrow function', () => {
    const actualCode = `const id = x => x;
      const square = x => x * x;
      export default square;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const id = x => x;
        const square = x => x * x;
        return pair(square, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of expression 1', () => {
    const actualCode = `export default 123;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        return pair(123, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of expression 2', () => {
    const actualCode = `export default "Hello world!";
    `
    const expectedCode = `function ${iifeIdentifier}() {
        return pair("Hello world!", list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of expression 3', () => {
    const actualCode = `export default 123 + 456;
    `
    const expectedCode = `function ${iifeIdentifier}() {
        // Expressions will be reduced when the IIFE is invoked.
        return pair(123 + 456, list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export of expression 4', () => {
    const actualCode = `function square(x) {
        return x * x;
      }
      export default square(10);
    `
    const expectedCode = `function ${iifeIdentifier}() {
        function square(x) {
          return x * x;
        }
        // Expressions will be reduced when the IIFE is invoked.
        return pair(square(10), list());
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  it('returns default export in {}-notation', () => {
    const actualCode = `
      const x = 42;
      function square(x) {
        return x * x;
      }
      const id = x => x;
      export { x, square as default, id };
    `
    const expectedCode = `function ${iifeIdentifier}() {
        const x = 42;
        function square(x) {
          return x * x;
        }
        const id = x => x;
        return pair(square, list(pair("x", x), pair("id", id)));
      }
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })
})

describe('removeExports', () => {
  const parseError = new Error('Unable to parse code')
  let actualContext = mockContext(Chapter.LIBRARY_PARSER)
  let expectedContext = mockContext(Chapter.LIBRARY_PARSER)

  beforeEach(() => {
    actualContext = mockContext(Chapter.LIBRARY_PARSER)
    expectedContext = mockContext(Chapter.LIBRARY_PARSER)
  })

  const assertASTsAreEquivalent = (actualCode: string, expectedCode: string): void => {
    const actualProgram = parse(actualCode, actualContext)
    const expectedProgram = parse(expectedCode, expectedContext)
    if (actualProgram === undefined || expectedProgram === undefined) {
      throw parseError
    }

    removeExports(actualProgram)
    expect(stripLocationInfo(actualProgram)).toEqual(stripLocationInfo(expectedProgram))
  }

  describe('removes ExportNamedDeclaration nodes', () => {
    test('when exporting variable declarations', () => {
      const actualCode = `export const x = 42;
        export let y = 53;
      `
      const expectedCode = `const x = 42;
        let y = 53;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting function declarations', () => {
      const actualCode = `export function square(x) {
          return x * x;
        }
      `
      const expectedCode = `function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting arrow function declarations', () => {
      const actualCode = `export const square = x => x * x;
      `
      const expectedCode = `const square = x => x * x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting (renamed) identifiers', () => {
      const actualCode = `const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
        export { x, y, square as sq, id as default };
      `
      const expectedCode = `const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })
  })

  describe('removes ExportDefaultDeclaration nodes', () => {
    // Default exports of variable declarations and arrow function declarations
    // is not allowed in ES6, and will be caught by the Acorn parser.
    test('when exporting function declarations', () => {
      const actualCode = `export default function square(x) {
          return x * x;
        }
      `
      const expectedCode = `function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting constants', () => {
      const actualCode = `const x = 42;
        export default x;
      `
      const expectedCode = `const x = 42;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting variables', () => {
      const actualCode = `let y = 53;
        export default y;
      `
      const expectedCode = `let y = 53;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting functions', () => {
      const actualCode = `function square(x) {
          return x * x;
        }
        export default square;
      `
      const expectedCode = `function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting arrow functions', () => {
      const actualCode = `const id = x => x;
        export default id;
      `
      const expectedCode = `const id = x => x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting expressions', () => {
      const actualCode = `export default 123 + 456;
      `
      const expectedCode = ''
      assertASTsAreEquivalent(actualCode, expectedCode)
    })
  })
})
