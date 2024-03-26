import { mockContext } from '../../../../mocks/context'
import { parse } from '../../../../parser/parser'
import { Chapter } from '../../../../types'
import hoistAndMergeImports from '../../transformers/hoistAndMergeImports'
import { parseCodeError, sanitizeAST } from '../utils'

describe('hoistAndMergeImports', () => {
  const assertASTsAreEqual = (actualCode: string, expectedCode: string) => {
    const actualContext = mockContext(Chapter.LIBRARY_PARSER)
    const expectedContext = mockContext(Chapter.LIBRARY_PARSER)

    const actualProgram = parse(actualCode, actualContext)
    const expectedProgram = parse(expectedCode, expectedContext)

    if (!actualProgram || !expectedProgram) {
      // console.log(actualContext.errors)
      throw parseCodeError
    }

    hoistAndMergeImports(actualProgram)

    expect(sanitizeAST(actualProgram)).toMatchObject(sanitizeAST(expectedProgram))
  }

  test.each([
    [
      `
      import { a, b, c } from "one_module";
      import { d } from "one_module";
      import { x } from "another_module";
      import { e, f } from "one_module";
      `,
      `
      import { a, b, c, d, e, f } from "one_module";
      import { x } from "another_module";
      `
    ],
    [
      `
      import c, { a as x, b as y } from 'one_module';
      import { a, b } from 'one_module';
      `,
      `
      import c, { a as x, a, b as y, b } from 'one_module';
      `
    ],
    [
      `
      import d, { a, b, c } from 'one_module';
      import e from 'one_module';
      `,
      `
      import e from 'one_module';
      import d, { a, b, c } from 'one_module';
      `
    ],
    [
      `
      import d from 'one_module';
      import { b, c } from 'one_module';
      import * as a from 'one_module';
      `,
      `
      import * as a from 'one_module';
      import d, { b, c } from 'one_module';
      `
    ],
    [`import 'one_module';`, `import 'one_module';`],
    [
      `
      import a from 'one_module';
      import 'another_module';
      import { x, y } from 'another_module';
      `,
      `
      import a from 'one_module';
      import { x, y } from 'another_module';
      `
    ],
    [
      `
      import a from './a.js';
      import { foo } from './b.js';
      import { b } from 'one_module';
      `,
      `
      import { b } from 'one_module';
      `
    ]
  ])('%#', (actualCode, expectedCode) => assertASTsAreEqual(actualCode, expectedCode))
})
