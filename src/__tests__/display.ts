import { stripIndent } from 'common-tags'
import createContext from '../createContext'
import { runInContext } from '../index'
import { Context, CustomBuiltIns, Finished } from '../types'

interface TestContext extends Context {
  displayResult?: string
}

function createTestContext(chapter: number = 1): TestContext {
  const context: TestContext = createContext(chapter, [], undefined, {
    rawDisplay: (str, externalContext) => {
      context.displayResult = context.displayResult ? context.displayResult + '\n' + str : str
      return str
    },
    prompt: (str, externalContext) => null,
    alert: (str, externalContext) => undefined,
    visualiseList: value => undefined
  } as CustomBuiltIns)
  return context
}

test('display can be used to display numbers', () => {
  const code = stripIndent`
  display(0);
  `
  const context = createTestContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(context.displayResult!).toBe('0')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display funny numbers', () => {
  const code = stripIndent`
  display(1e38);
  display(NaN);
  display(Infinity);
  `
  const context = createTestContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display (escaped) strings', () => {
  const code = stripIndent`
  display("Tom's assisstant said: \\"tuna.\\"");
  `
  const context = createTestContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(context.displayResult!).toBe('"Tom\'s assisstant said: \\"tuna.\\""')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('raw_display can be used to display (unescaped) strings directly', () => {
  const code = stripIndent`
  raw_display("Tom's assisstant said: \\"tuna.\\"");
  `
  const context = createTestContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(context.displayResult!).toBe('Tom\'s assisstant said: "tuna."')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display functions', () => {
  const code = stripIndent`
  display(x => x);
  display((x, y) => x + y);
  `
  const context = createTestContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display lists', () => {
  const code = stripIndent`
  display(list(1, 2));
  `
  const context = createTestContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display arrays', () => {
  const code = stripIndent`
  display([1, 2, [4, 5]]);
  `
  const context = createTestContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('display can be used to display objects', () => {
  const code = stripIndent`
  display({a: 1, b: 2, c: {d: 3}});
  `
  const context = createTestContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(context.errors).toEqual([])
    expect(context.displayResult!).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})
