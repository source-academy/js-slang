import { mockContext } from '../../mocks/context'
import { runCodeInSource } from '../../runner'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'

const getContextFrom = async (code: string) => {
  const context = mockContext(Chapter.SOURCE_4)
  await runCodeInSource(code, context, { executionMethod: 'cse-machine' })
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
