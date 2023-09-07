import { Program } from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../../utils/operators'
import {
  InfiniteLoopRuntimeFunctions as functionNames,
  InfiniteLoopRuntimeObjectNames,
  instrument
} from '../instrument'

function mockFunctionsAndState() {
  const theState = undefined
  const functions = {}
  const returnFirst = (...args: any[]) => args[0]
  const nothing = (..._args: any[]) => {}
  functions[functionNames.nothingFunction] = nothing
  functions[functionNames.concretize] = returnFirst
  functions[functionNames.hybridize] = returnFirst
  functions[functionNames.wrapArg] = returnFirst
  functions[functionNames.dummify] = returnFirst
  functions[functionNames.saveBool] = returnFirst
  functions[functionNames.saveVar] = returnFirst
  functions[functionNames.preFunction] = nothing
  functions[functionNames.returnFunction] = returnFirst
  functions[functionNames.postLoop] = (_: any, res?: any) => res
  functions[functionNames.enterLoop] = nothing
  functions[functionNames.exitLoop] = nothing
  functions[functionNames.trackLoc] = (_1: any, _2: any, fn?: any) => (fn ? fn() : undefined)
  functions[functionNames.evalB] = evaluateBinaryExpression
  functions[functionNames.evalU] = evaluateUnaryExpression
  return [functions, theState]
}

/**
 * Returns the value saved in the code using the builtin 'output'.
 * e.g. runWithMock('output(2)') --> 2
 */
async function runWithMock(
  main: string,
  codeHistory?: string[],
  builtins: Map<string, any> = new Map()
) {
  let output = undefined
  builtins.set('output', (x: any) => (output = x))
  builtins.set('undefined', undefined)
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(main, context)
  expect(program).not.toBeUndefined()
  let previous: Program[] = []
  if (codeHistory !== undefined) {
    const restOfCode = codeHistory.map(x => parse(x, context))
    for (const code of restOfCode) {
      expect(code).not.toBeUndefined()
    }
    previous = restOfCode as Program[]
  }
  const [mockFunctions, mockState] = mockFunctionsAndState()
  const instrumentedCode = await instrument(previous, program as Program, builtins.keys())
  const { builtinsId, functionsId, stateId } = InfiniteLoopRuntimeObjectNames
  const sandboxedRun = new Function('code', functionsId, stateId, builtinsId, `return eval(code)`)
  await sandboxedRun(instrumentedCode, mockFunctions, mockState, builtins)
  return output
}

test('builtins work', () => {
  const main = 'output(2);'
  return expect(runWithMock(main, [])).resolves.toBe(2)
})

test('binary and unary expressions work', () => {
  return Promise.all([
    expect(runWithMock('output(1+1);', [])).resolves.toBe(2),
    expect(runWithMock('output(!true);', [])).resolves.toBe(false)
  ])
})

test('assignment works as expected', () => {
  const main = `let x = 2;
  let a = [];
  a[0] = 3;
  output(x+a[0]);`
  return expect(runWithMock(main)).resolves.toBe(5)
})

test('globals from old code accessible', () => {
  const main = 'output(z+1);'
  const prev = ['const z = w+1;', 'let w = 10;']
  return expect(runWithMock(main, prev)).resolves.toBe(12)
})

test('functions run as expected', () => {
  const main = `function f(x,y) {
    return x===0?x:f(x-1,y)+y;
  }
  output(f(5,2));`
  return expect(runWithMock(main)).resolves.toBe(10)
})

test('nested functions run as expected', () => {
  const main = `function f(x,y) {
    function f(x,y) {
      return 0;
    }
    return x===0?x:f(x-1,y)+y;
  }
  output(f(5,2));`
  return expect(runWithMock(main)).resolves.toBe(2)
})

test('higher order functions run as expected', () => {
  const main = `function run(f, x) {
    return f(x+1);
  }
  output(run(x=>x+1, 1));`
  return expect(runWithMock(main)).resolves.toBe(3)
})

test('loops run as expected', () => {
  const main = `let w = 0;
  for (let i = w; i < 10; i=i+1) {w = i;}
  output(w);`
  return expect(runWithMock(main)).resolves.toBe(9)
})

test('nested loops run as expected', () => {
  const main = `let w = 0;
  for (let i = w; i < 10; i=i+1) {
    for (let j = 0; j < 10; j=j+1) {
      w = w + 1;
    }
  }
  output(w);`
  return expect(runWithMock(main)).resolves.toBe(100)
})

test('multidimentional arrays work', () => {
  const main = `const x = [[1],[2]];
  output(x[1] === undefined? undefined: x[1][0]);`
  return expect(runWithMock(main)).resolves.toBe(2)
})

test('if statements work as expected', () => {
  const main = `let x = 1;
  if (x===1) {
    x = x + 1;
  } else {}
  output(x);`
  return expect(runWithMock(main)).resolves.toBe(2)
})

test('combination of loops and functions run as expected', () => {
  const main = `function test(x) {
    return x===0;
  }
  const minus = (a,b) => a-b;
  let w = 10;
  let z = 0;
  while(!test(w)) {
    for (let j = 0; j < 10; j=j+1) {
      z = z + 1;
    }
    w = minus(w,1);
  }
  output(z);`
  return expect(runWithMock(main)).resolves.toBe(100)
})
