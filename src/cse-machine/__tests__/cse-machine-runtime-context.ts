import type { IOptions } from '../..'
import { mockContext } from '../../mocks/context'
import { runCodeInSource } from '../../runner'
import { Chapter, type RecursivePartial } from '../../types'
import { stripIndent } from '../../utils/formatters'

const getContextFrom = async (code: string, steps?: number) => {
  const context = mockContext(Chapter.SOURCE_4)
  const options: RecursivePartial<IOptions> = { executionMethod: 'cse-machine' }
  if (steps !== undefined) {
    options.envSteps = steps
  }
  await runCodeInSource(code, context, options)
  return context
}

const codeSamples = [
  `
    function create(n) {
      const arr = [];
      let x = 0;
      
      while (x < n) {
          arr[x] = () => x;
          x = x + 1;
          debugger;
      }
      return arr;
    }
    debugger;
    create(3)[1]();
  `,
  `
    let a = 0;
    debugger;
    function f(x) {
      if (x <= 0) {
        return x => x;
      }
      a = list(a);
      debugger;
      return f(x - 1);
    }
    apply_in_underlying_javascript(f, list(3));
    debugger;
  `,
  `
    const s = build_stream(i => {
      const prev = i > 0 ? stream_ref(s, i - 1) : -1;
      debugger;
      return i;
    }, 5);
    apply_in_underlying_javascript(stream_ref, list(s, 4));
  `,
  `
    const s = build_stream(i => {
      const prev = i > 0 ? stream_ref(s, i - 1) : -1;
      debugger;
      return i;
    }, 5);
    stream_ref(s, 4);
  `
]

const contexts = codeSamples.map(code => getContextFrom(stripIndent(code)))

for (const context of contexts) {
  test(`Breakpoint steps match`, async () => {
    expect((await context).runtime.breakpointSteps).toMatchSnapshot()
  })
  test(`Changepoint steps match`, async () => {
    expect((await context).runtime.changepointSteps).toMatchSnapshot()
  })
}
test('Avoid unnescessary environment instruction 1', async () => {
  const context = getContextFrom(
    stripIndent(
      `
      function f(n) {
        return n === 0
        ? 1
        : f(n-1) * 2;
      }
      f(3);
    `
    ),
    61
  )
  expect((await context).runtime.control).toMatchSnapshot()
})

test('Avoid unnescessary environment instruction 2', async () => {
  const context = getContextFrom(
    stripIndent(
      `
      function f(n) {
        return n === 0
        ? 1
        : n * f(n-1);
      }
      f(3);
    `
    ),
    63
  )
  expect((await context).runtime.control).toMatchSnapshot()
})

test('Avoid unnescessary environment instruction 3', async () => {
  const context = getContextFrom(
    stripIndent(
      `
      let a = 1;
      function f(n) {
          return n === 0
          ? 1
          : n * f(n-1);
      }
      f(3);
      a = 2;
    `
    ),
    66
  )
  expect((await context).runtime.control).toMatchSnapshot()
})

test('Avoid unnescessary environment instruction 4', async () => {
  const context = getContextFrom(
    stripIndent(
      `
      {
        let a = 1;
        let b = 2;
      }
      
      {
          1 + 2;
          3;
      }
    `
    ),
    3
  )
  expect((await context).runtime.control).toMatchSnapshot()
})
