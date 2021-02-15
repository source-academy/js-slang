import { stripIndent } from '../../utils/formatters'
import { parseTypescript, parseTypescriptAsSource, stripTypescript, checkFormatting } from '../parser'
import { createTestContext, removeUndefined, removeKeys } from '../../utils/testing'

test.each([
  [
    1,
    `
    `
  ],

  [
    1,
    `
    const a: number = 5;
    a;
    `
  ],

  [
    1,
    `
    const a: number = 5;

    a;
    `
  ],

  [
    1,
    `
    const a = (5 as number);
    a;
    `
  ],

  [
    1,
    `
    function f(x: unknown): x is number {
      return is_number(x);
    }
    f(5);
    `
  ],

  [
    1,
    `
    function f(x:
      unknown):
      x is number {
      return is_number(x);
    }
    f(

    5
    );
    `
  ],

  [
    1,
    `
    function name(a: number, b: number): number {
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
    1,
    `
    (() => true)();
    `
  ],

  [
    1,
    `
    (<T extends number | string>(x: T, y: T): T => { return x + y; })(1, 2);
    `
  ],

  [
    1,
    `
    true;
    `
  ],

  [
    1,
    `
    (false as boolean);
    `
  ],

  [
    1,
    `
    'a string "" \\'\\'';
    `
  ],

  [
    1,
    `
    31.4 + (-3.14e10) * -1 % 2 / (1.5 as number);
    `
  ],

  [
    1,
    `
    1 === 1 && 1 < 2 && 1 <= 2 && 2 >= 1 && 2 > 1 || false;
    `
  ],

  [
    1,
    `
    true ? 1 : 2;
    `
  ],

  [
    2,
    `
    null;
    `
  ],

  [
    2,
    `
    pair(1 as const, null);
    `
  ],

  [
    2,
    `
    list(1 as const);
    `
  ],

  [
    3,
    `
    let i: number = 1;
    while (i < 5) {
      i = i + 1;
    }
    i;
    `
  ],

  [
    3,
    `
    let i = 1;
    for (i = 1; i < 5; i = i + 1) {
    }
    i;
    `
  ],

  [
    3,
    `
    let i = 1;
    for (let j = 0; j < 5; j = j + 1) {
      if (j < 1) {
        continue;
      } else {
        i = i + 1;
        if (j > 2) {
          break;
        } else {
        }
      }
    }
    i;
    `
  ],

  [
    3,
    `
    let i = 1;
    for (let j: number = 0; j < 5; j = j + 1) {
      if (j < 1) {
        continue;
      } else {
        i = i + 1;
        if (j > 2) {
          break;
        } else {
        }
      }
    }
    i;
    `
  ],

  [
    3,
    `
    [];
    `
  ],

  [
    3,
    `
    [(1 as number), 2, (3 as const)];
    `
  ],

  [
    3,
    `
    [1, 2, 3][1 as number];
    `
  ],

  [
    3,
    `
    let x: number[] = [1, 2, 3];
    x[1];
    `
  ],

  [
    3,
    `
    let x: [1, 2, 3] = [1, 2, 3];
    x[1] = 4;
    `
  ],

  [
    3,
    `
    let x = 3;
	  let y: any = 4;
	  let z: unknown = 5;
	  x = y = z = 6;
	  x;
	  `
  ],

  [
    100,
    `
    ({});
    `
  ],

  [
    100,
    `
    ({a: 1, b: 2});
    `
  ],

  [
    100,
    `
    ({a: 1, b: 2})['a'];
    `
  ],

  [
    100,
    `
    ({a: 1, b: 2}).a;
    `
  ],

  [
    100,
    `
    ({'a': 1, 'b': 2}).a;
    `
  ],

  [
    100,
    `
    ({1: 1, 2: 2})['1'];
    `
  ],

  [
    100,
    `
    const key = 'a';
    ({a: 1, b: 2})[key];
    `
  ],

  [
    100,
    `
    let x = {a: 1, b: 2};
    x.a = 3;
    `
  ],

  [
    100,
    `
    let x = {a: 1, b: 2};
    x['a'] = 3;
    `
  ],

  [
    100,
    `
    let x: object = {a: 1, b: 2};
    const key: string = 'a';
    x[key] = 3;
    `
  ]
] as [number, string][])(
  'Typescript syntax is allowed at any chapter %#',
  (chapter: number, snippet: string) => {
    snippet = stripIndent(snippet)
    const context = createTestContext({ chapter })
    const sourceSource = stripTypescript(snippet, context)
    const typescriptProgram = parseTypescript(snippet, context)
    const sourceProgram = parseTypescriptAsSource(snippet, context)
    const cleanedTypescriptProgram = removeKeys(removeUndefined(typescriptProgram), ['loc', 'end', 'start'])
    const cleanedSourceProgram = removeKeys(removeUndefined(sourceProgram), ['loc', 'end', 'start'])
    const lintResult = checkFormatting(snippet)
    expect(snippet).toMatchSnapshot()
    expect(sourceSource).toMatchSnapshot()
    expect(cleanedTypescriptProgram).toMatchSnapshot()
    expect(cleanedSourceProgram).toMatchSnapshot()
    expect(lintResult).toMatchSnapshot()
  }
)
