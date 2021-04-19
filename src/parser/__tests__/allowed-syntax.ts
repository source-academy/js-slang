import { stripIndent } from '../../utils/formatters'
import { snapshotFailure, snapshotSuccess } from '../../utils/testing'

test.each([
  [1, ''],

  [
    1,
    stripIndent`
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
    1,
    stripIndent`
    (() => true)();
    `
  ],

  [
    1,
    stripIndent`
    ((x, y) => { return x + y; })(1, 2);
    `
  ],

  [
    1,
    stripIndent`
    true;
    `
  ],

  [
    1,
    stripIndent`
    false;
    `
  ],

  [
    1,
    stripIndent`
    'a string "" \\'\\'';
    `
  ],

  [
    1,
    stripIndent`
    31.4 + (-3.14e10) * -1 % 2 / 1.5;
    `
  ],

  [
    1,
    stripIndent`
    1 === 1 && 1 < 2 && 1 <= 2 && 2 >= 1 && 2 > 1 || false;
    `
  ],

  [
    1,
    stripIndent`
    true ? 1 : 2;
    `
  ],

  [
    2,
    stripIndent`
    null;
    `
  ],

  [
    2,
    stripIndent`
    pair(1, null);
    `
  ],

  [
    2,
    stripIndent`
    list(1);
    `
  ],

  [
    3,
    stripIndent`
    let i = 1;
    while (i < 5) {
      i = i + 1;
    }
    i;
    `
  ],

  [
    3,
    stripIndent`
    let i = 1;
    for (i = 1; i < 5; i = i + 1) {
    }
    i;
    `
  ],

  [
    3,
    stripIndent`
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
    stripIndent`
    [];
    `
  ],

  [
    3,
    stripIndent`
    [1, 2, 3];
    `
  ],

  [
    3,
    stripIndent`
    [1, 2, 3][1];
    `
  ],

  [
    3,
    stripIndent`
    let x = [1, 2, 3];
    x[1];
    `
  ],

  [
    3,
    stripIndent`
    let x = [1, 2, 3];
    x[1] = 4;
    `
  ],

  [
    3,
    stripIndent`
    let x = 3;
    let y = 4;
    let z = 5;
    x = y = z = 6;
    x;
    `
  ],

  [
    100,
    stripIndent`
    ({});
    `
  ],

  [
    100,
    stripIndent`
    ({a: 1, b: 2});
    `
  ],

  [
    100,
    stripIndent`
    ({a: 1, b: 2})['a'];
    `
  ],

  [
    100,
    stripIndent`
    ({a: 1, b: 2}).a;
    `
  ],

  [
    100,
    stripIndent`
    ({'a': 1, 'b': 2}).a;
    `
  ],

  [
    100,
    stripIndent`
    ({1: 1, 2: 2})['1'];
    `
  ],

  [
    100,
    stripIndent`
    const key = 'a';
    ({a: 1, b: 2})[key];
    `
  ],

  [
    100,
    stripIndent`
    let x = {a: 1, b: 2};
    x.a = 3;
    `
  ],

  [
    100,
    stripIndent`
    let x = {a: 1, b: 2};
    x['a'] = 3;
    `
  ],

  [
    100,
    stripIndent`
    let x = {a: 1, b: 2};
    const key = 'a';
    x[key] = 3;
    `
  ]
] as [number, string][])(
  'Syntaxes are allowed in the chapter they are introduced %#',
  (chapter: number, snippet: string) => {
    snippet = stripIndent(snippet)
    const parseSnippet = `parse(${JSON.stringify(snippet)});`
    const tests = [
      snapshotSuccess(snippet, { chapter, native: chapter < 100 }, 'passes'),
      snapshotSuccess(parseSnippet, { chapter: Math.max(4, chapter), native: true }, 'parse passes')
    ]
    if (chapter > 1) {
      tests.push(snapshotFailure(snippet, { chapter: chapter - 1 }, 'fails a chapter below'))
    }
    return Promise.all(tests)
  }
)
