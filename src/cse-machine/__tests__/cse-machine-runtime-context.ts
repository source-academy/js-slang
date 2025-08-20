import type es from 'estree'
import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { parse } from '../../parser/parser'
import { runCodeInSource, type SourceExecutionOptions } from '../../runner'
import type { RecursivePartial } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { mockContext } from '../../utils/testing/mocks'
import { generateCSEMachineStateStream } from '../interpreter'
import { Control, Stash, Transformers } from '../types'

const getContextFrom = async (code: string, steps?: number) => {
  const context = mockContext(Chapter.SOURCE_4)
  const options: RecursivePartial<SourceExecutionOptions> = {
    executionMethod: 'cse-machine',
    envSteps: steps
  }

  await runCodeInSource(code, context, options)
  return context
}

const evaluateCode = (code: string) => {
  const context = mockContext(Chapter.SOURCE_4)
  const options: RecursivePartial<SourceExecutionOptions> = { executionMethod: 'cse-machine' }
  const program = parse(code, context)
  context.runtime.isRunning = true
  context.runtime.control = new Control(program as es.Program)
  context.runtime.stash = new Stash()
  context.runtime.transformers = new Transformers()

  const CSEState = generateCSEMachineStateStream(
    context,
    context.runtime.control,
    context.runtime.stash,
    options.envSteps ?? -1,
    options.stepLimit ?? -1,
    options.isPrelude
  )
  return CSEState
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
test('Avoid unnescessary environment instruction', () => {
  const CSEState = evaluateCode(
    stripIndent(
      `
        function f(n) {
          return n === 0
          ? 1
          : f(n-1) * 2;
        }
        f(3);
      `
    )
  )

  for (const state of CSEState) {
    expect(state.control.getNumEnvDependentItems()).toMatchSnapshot()
  }
})

test('Avoid unnescessary environment instruction', () => {
  const CSEState = evaluateCode(
    stripIndent(
      `
        function f(n) {
          return n === 0
          ? 1
          : n * f(n-1);
        }
        f(3);
      `
    )
  )

  for (const state of CSEState) {
    expect(state.control.getNumEnvDependentItems()).toMatchSnapshot()
  }
})

test('Avoid unnescessary environment instruction', () => {
  const CSEState = evaluateCode(
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
    )
  )

  for (const state of CSEState) {
    expect(state.control.getNumEnvDependentItems()).toMatchSnapshot()
  }
})

test('Avoid unnescessary environment instruction', () => {
  const CSEState = evaluateCode(
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
    )
  )

  for (const state of CSEState) {
    expect(state.control.getNumEnvDependentItems()).toMatchSnapshot()
  }
})

test('Avoid unnescessary environment instruction', () => {
  const CSEState = evaluateCode(
    stripIndent(
      `
      import "rune";
      const arr = [1,2,3];
      const c = (x => x)(1);
      let sum = 0;

      function add(x, y) {
          return x + y;
      }

      for(let i = 1; i < 10; i = i + 1) {
          let j = 0;
          while(j < i) {
              sum = add(sum, i);
              j = j + 1;
          }
          if (sum > 100 && sum < 200) {
              arr[0] = sum;
              break;
          }
      }
      display(sum);
    `
    )
  )

  for (const state of CSEState) {
    expect(state.control.getNumEnvDependentItems()).toMatchSnapshot()
  }
})
