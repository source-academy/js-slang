import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'

test('Syntaxes are allowed in the chapter they are introduced', () => {
  const code = [
    [1, `
  `],
    [1, `
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
  `],
    [1, `
    (() => true)();
  `],
    [1, `
    ((x, y) => { return x + y; })(1, 2);
  `],
    [1, `
    true;
  `],
    [1, `
    false;
  `],
    [1, `
    'a string "" \\'\\'';
  `],
    [1, `
    31.4 + (-3.14e10) * -1 % 2 / 1.5;
  `],
    [1, `
    !false === (1 !== 2) && 1 < 2 && 1 <= 2 && 2 >= 1 && 2 > 1 || false;
  `],

    [2, `
    null;
  `],
    [2, `
    pair(1, null);
  `],
    [2, `
    list(1);
  `],

    [3, `
    let i = 1;
    while (i < 5) {
      i = i + 1;
    }
    i;
  `],
    [3, `
    let i = 1;
    for (i = 1; i < 5; i = i + 1) {
    }
    i;
  `],
    [3, `
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
  `],
    [3, `
    [];
  `],
    [3, `
    [1, 2, 3];
  `],
    [3, `
    [1, 2, 3][1];
  `],

    [100, `
    ({});
  `],
    [100, `
    ({a: 1, b: 2});
  `],
    [100, `
    ({a: 1, b: 2})['a'];
  `],

    // TODO: To make this work we need to allow rules to apply for specific chapters
    /*
    [100, `
    ({a: 1, b: 2}).a;
  `],
  */
  ]

  const scheduler = 'preemptive'
  const promises = code.map(c => {
    const chapter = c[0] as number
    const snippet = c[1] as string
    const context = mockContext(chapter)
    return runInContext(snippet, context, { scheduler }).then(obj => ({
      snippet,
      context,
      obj
    }))
  })
  return Promise.all(promises).then(results => {
    results.map(res => {
      const { snippet, context, obj } = res
      const errors = parseError(context.errors)

      // If you hit an error here, you have changed the snippets but not changed the snapshot
      expect(snippet).toMatchSnapshot()

      expect(errors).toMatchSnapshot()
      expect(obj.status).toBe('finished')
      expect((obj as Finished).value).toMatchSnapshot()
    })
  })
})
