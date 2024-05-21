import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { parse } from '../parser'

function testParse(chapter: Chapter, code: string) {
  const context = mockContext(chapter)
  parse(code, context)

  return context.errors.length === 0
}

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

  [
    Chapter.LIBRARY_PARSER,
    `import { default as x } from './a.js';`,
  ],
  [Chapter.LIBRARY_PARSER, `import * as a from 'one_module';`]
])("%#", (chapter, code) => {
  test(`Should pass for Chapter ${chapter}`, () => {
    expect(testParse(chapter, code)).toEqual(true)
  })

  if (chapter > 1) {
    // Parsing should fail for the chapter below the one they
    // are introduced in
    test(`Should fail for Chapter ${chapter - 1}`, () => {
      expect(testParse(chapter - 1, code)).toEqual(false)
    })
  }
})
