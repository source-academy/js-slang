import { parseError } from '../..'
import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectFinishedResult, testSuccess } from '../../utils/testing'
import { assertFinishedResultValue } from '../../utils/testing/misc'
import { mockContext } from '../../utils/testing/mocks'
import { parse } from '../parser'

jest.mock('../../modules/loader/loaders')

describe.each([
  [Chapter.SOURCE_1, ''],

  [
    Chapter.SOURCE_1,
    `
    function name(a, b) {
      const sum = a + b;
      if (sum > 1) {
        return sum;
      } else {
        if (a % 2 === 0) {
          return -1;
        } else if (b % 2 === 0) {
          return 1;
        } else {
          return a > b ? 0 : -2;
        }
      }
    }
    name(1, 2);
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    (() => true)();
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    ((x, y) => { return x + y; })(1, 2);
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    true;
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    false;
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    'a string "" \\'\\'';
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    31.4 + (-3.14e10) * -1 % 2 / 1.5;
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    1 === 1 && 1 < 2 && 1 <= 2 && 2 >= 1 && 2 > 1 || false;
    `
  ],

  [
    Chapter.SOURCE_1,
    `
    true ? 1 : 2;
    `
  ],

  [
    Chapter.SOURCE_2,
    `
    null;
    `
  ],

  [
    Chapter.SOURCE_2,
    `
    pair(1, null);
    `
  ],

  [
    Chapter.SOURCE_2,
    `
    export function f(x) {
      return x;
    }
    f(5);
    `
  ],

  [
    Chapter.SOURCE_2,
    `
    export const x = 1;
    x;
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let i = 1;
    while (i < 5) {
      i = i + 1;
    }
    i;
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let i = 1;
    for (i = 1; i < 5; i = i + 1) {
    }
    i;
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let i = 1;
    for (let j = 0; j < 5; j = j + 1) {
      if (j < 1) {
        continue;
      } else {
        i = i + 1;
        if (j > 2) {
          break;
        }
      }
    }
    i;
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    [];
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    [1, 2, 3];
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    [1, 2, 3][1];
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let x = [1, 2, 3];
    x[1];
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let x = [1, 2, 3];
    x[1] = 4;
    `
  ],

  [
    Chapter.SOURCE_3,
    `
    let x = 3;
    let y = 4;
    let z = 5;
    x = y = z = 6;
    x;
    `
  ],
  [
    Chapter.SOURCE_3,
    `
    function f(x, y, ...z) {
      return x + y;
    }
    f(...[1, 2]);
    `
  ],
  [
    Chapter.LIBRARY_PARSER,
    `
    ({});
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    ({a: 1, b: 2});
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    ({a: 1, b: 2})['a'];
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    ({a: 1, b: 2}).a;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    ({'a': 1, 'b': 2}).a;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    ({1: 1, 2: 2})['1'];
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    const key = 'a';
    ({a: 1, b: 2})[key];
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    let x = {a: 1, b: 2};
    x.a = 3;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    let x = {a: 1, b: 2};
    x['a'] = 3;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    let x = {a: 1, b: 2};
    const key = 'a';
    x[key] = 3;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    import defaultExport from "one_module";
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    export default function f(x) {
      return x;
    }
    f(5);
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    const x = 1;
    export default x;
    x;
    `
  ],

  [
    Chapter.LIBRARY_PARSER,
    `
    function square(x) {
      return x * x;
    }
    export { square as default };
    `
  ],

  [Chapter.LIBRARY_PARSER, `import { default as x } from 'one_module';`],
  [Chapter.LIBRARY_PARSER, `import * as a from 'one_module';`, true]
] as [Chapter, string, boolean | undefined][])(
  'Syntaxes are allowed in the chapter they are introduced %#',
  (chapter: Chapter, snippet: string, skipSuccessTests: boolean = false) => {
    snippet = stripIndent(snippet)

    if (!skipSuccessTests) {
      test('Test regular parser', () => {
        const context = mockContext(chapter)
        const result = parse(snippet, context)
        expect(result).not.toBeNull()
        expect(result).toMatchSnapshot()
      })

      test('Test stdlib parser', () => {
        const parseSnippet = `parse(${JSON.stringify(snippet)});`
        return expectFinishedResult(
          parseSnippet,
          Math.max(Chapter.SOURCE_4, chapter)
        ).toMatchSnapshot()
      })
    }

    if (chapter > 1) {
      test('Test 1 chapter below', () => {
        const context = mockContext(chapter - 1)
        const result = parse(snippet, context)
        expect(result).toBeNull()
        expect(parseError(context.errors)).toMatchSnapshot()
      })
    }
  }
)

test('typeof operator is allowed in typed variant', async () => {
  const { result } = await testSuccess(`typeof "0";`, { variant: Variant.TYPED })
  assertFinishedResultValue(result, 'string')
})
