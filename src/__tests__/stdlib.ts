import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'

test('Syntaxes are allowed in the chapter they are introduced', () => {
  const code = [
    [
      1,
      `
      display('message');
      `,
      true,
      'message'
    ],

    [
      1,
      `
      error('error!');
      `,
      false,
      undefined
    ],

    [
      1,
      `
      is_undefined(undefined);
      `,
      true,
      true
    ],

    [
      2,
      `
      is_undefined(null);
      `,
      true,
      false
    ],

    [
      2,
      `
      is_null(undefined);
      `,
      true,
      false
    ],

    [
      2,
      `
      is_null(null);
      `,
      true,
      true
    ],

    [
      1,
      `
      is_string('string');
      `,
      true,
      true
    ],

    [
      1,
      `
      is_string('true');
      `,
      true,
      true
    ],

    [
      1,
      `
      is_string('1');
      `,
      true,
      true
    ],

    [
      1,
      `
      is_string(true);
      `,
      true,
      false
    ],

    [
      1,
      `
      is_string(1);
      `,
      true,
      false
    ],

    [
      1,
      `
      is_number('string');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_number('true');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_number('1');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_number(true);
      `,
      true,
      false
    ],

    [
      1,
      `
      is_number(1);
      `,
      true,
      true
    ],

    [
      1,
      `
      is_boolean('string');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_boolean('true');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_boolean('1');
      `,
      true,
      false
    ],

    [
      1,
      `
      is_boolean(true);
      `,
      true,
      true
    ],

    [
      1,
      `
      is_boolean(1);
      `,
      true,
      false
    ],

    [
      1,
      `
      is_function(display);
      `,
      true,
      true
    ],

    [
      1,
      `
      is_function(x => x);
      `,
      true,
      true
    ],

    [
      1,
      `
      function f(x) {
        return x;
      }
      is_function(f);
      `,
      true,
      true
    ],

    [
      1,
      `
      is_function(1);
      `,
      true,
      false
    ],

    [
      3,
      `
      is_array(1);
      `,
      true,
      false
    ],

    [
      3,
      `
      is_array(pair(1, 2));
      `,
      true,
      true
    ],

    [
      3,
      `
      is_array([1]);
      `,
      true,
      true
    ],

    [
      3,
      `
      array_length([1]);
      `,
      true,
      1
    ],

    [
      1,
      `
      parse_int('10', 10);
      `,
      true,
      10
    ],

    [
      1,
      `
      parse_int('10', 2);
      `,
      true,
      2
    ],

    [
      1,
      `
      is_number(runtime());
      `,
      true,
      true
    ],

    [
      1,
      `
      const x = runtime();
      const f = x => x === 0 ? x : f(x-1);
      f(1000);
      const y = runtime();
      x !== y;
      `,
      true,
      true
    ],

    [
      2,
      `
      pair(1, 2);
      `,
      true,
      [1, 2]
    ],

    [
      2,
      `
      list(1, 2);
      `,
      true,
      [1, [2, null]]
    ],

    [
      2,
      `
      is_list(1);
      `,
      true,
      false
    ],

    [
      2,
      `
      is_list(pair(1, 2));
      `,
      true,
      false
    ],

    [
      2,
      `
      is_list(list(1, 2));
      `,
      true,
      true
    ],

    [
      2,
      `
      head(pair(1, 2));
      `,
      true,
      1
    ],

    [
      2,
      `
      tail(pair(1, 2));
      `,
      true,
      2
    ],

    [
      2,
      `
      head(null);
      `,
      false,
      undefined
    ],

    [
      2,
      `
      tail(null);
      `,
      false,
      undefined
    ],

    [
      2,
      `
      head(1);
      `,
      false,
      undefined
    ],

    [
      2,
      `
      tail(1);
      `,
      false,
      undefined
    ],

    [
      2,
      `
      length(list(1, 2));
      `,
      true,
      2
    ],

    [
      2,
      `
      length(1);
      `,
      false,
      undefined
    ]
  ]

  const scheduler = 'preemptive'
  const promises = code.map(c => {
    const chapter = c[0] as number
    const snippet = c[1] as string
    const passing = c[2] as boolean
    const returnValue = c[3]
    const context = mockContext(chapter)
    return runInContext(snippet, context, { scheduler }).then(runResult => ({
      snippet,
      context,
      passing,
      returnValue,
      runResult
    }))
  })
  return Promise.all(promises).then(results => {
    results.map(res => {
      const { snippet, context, passing, returnValue, runResult } = res
      const errors = parseError(context.errors)

      // If you hit an error here, you have changed the snippets but not changed the snapshot
      expect(snippet).toMatchSnapshot()

      expect(errors).toMatchSnapshot()
      if (passing) {
        expect(runResult.status).toBe('finished')
        expect((runResult as Finished).value).toEqual(returnValue)
      } else {
        expect(runResult.status).toBe('error')
      }
    })
  })
})
