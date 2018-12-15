import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'

test('Syntaxes are allowed in the chapter they are introduced', () => {
  const code = [
    [
      1,
      `
      `
    ],

    [
      1,
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
      1,
      `
      (() => true)();
      `
    ],

    [
      1,
      `
      ((x, y) => { return x + y; })(1, 2);
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
      false;
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
      31.4 + (-3.14e10) * -1 % 2 / 1.5;
      `
    ],

    [
      1,
      `
      !false === (1 !== 2) && 1 < 2 && 1 <= 2 && 2 >= 1 && 2 > 1 || false;
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
      pair(1, null);
      `
    ],

    [
      2,
      `
      list(1);
      `
    ],

    [
      3,
      `
      let i = 1;
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
      [];
      `
    ],

    [
      3,
      `
      [1, 2, 3];
      `
    ],

    [
      3,
      `
      [1, 2, 3][1];
      `
    ],

    [
      3,
      `
      let x = [1, 2, 3];
      x[1];
      `
    ],

    [
      3,
      `
      let x = [1, 2, 3];
      x[1] = 4;
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
      let x = {a: 1, b: 2};
      const key = 'a';
      x[key] = 3;
      `
    ]
  ]

  const scheduler = 'preemptive'
  const promises = code.map(c => {
    const chapter = c[0] as number
    const snippet = c[1] as string
    const parseSnippet = `parse(${JSON.stringify(snippet)});`
    const successContext = mockContext(chapter)
    const parseContext = mockContext(Math.max(4, chapter))
    const failureContext = mockContext(chapter - 1)
    return runInContext(snippet, successContext, { scheduler }).then(runResult =>
      runInContext(parseSnippet, parseContext, { scheduler }).then(parseResult =>
        runInContext(snippet, failureContext, { scheduler }).then(failureResult => ({
          chapter,
          snippet,
          parseSnippet,
          successContext,
          parseContext,
          failureContext,
          runResult,
          parseResult,
          failureResult
        }))
      )
    )
  })
  return Promise.all(promises).then(results => {
    results.map(res => {
      const {
        chapter,
        snippet,
        parseSnippet,
        successContext,
        parseContext,
        failureContext,
        runResult,
        parseResult,
        failureResult
      } = res
      const successErrors = parseError(successContext.errors)
      const parseErrors = parseError(parseContext.errors)
      const failureErrors = parseError(failureContext.errors)

      // If you hit an error here, you have changed the snippets but not changed the snapshot
      expect(snippet).toMatchSnapshot()
      expect(parseSnippet).toMatchSnapshot()

      expect(successErrors).toMatchSnapshot()
      expect(parseErrors).toMatchSnapshot()
      expect(runResult.status).toBe('finished')
      expect((runResult as Finished).value).toMatchSnapshot()
      expect(parseResult.status).toBe('finished')
      expect((parseResult as Finished).value).toMatchSnapshot()

      if (chapter > 1) {
        expect(failureErrors).toMatchSnapshot()
        expect(failureResult.status).toBe('error')
      }
    })
  })
})
