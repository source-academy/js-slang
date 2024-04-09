import { mockClosure, mockContext } from '../../mocks/context'
import { runCodeInSource } from '../../runner'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import Heap from '../heap'
import type { EnvArray } from '../types'

test('Heap works correctly', () => {
  const heap1 = new Heap()
  expect(heap1.size()).toMatchInlineSnapshot(`0`)
  expect(heap1.getHeap()).toMatchInlineSnapshot(`Set {}`)

  const arr = [0] as EnvArray
  const closure = mockClosure(true)
  heap1.add(arr, closure)
  heap1.add(arr)
  expect(heap1.contains([0] as EnvArray)).toMatchInlineSnapshot(`false`)
  expect(heap1.contains(arr)).toMatchInlineSnapshot(`true`)
  expect(heap1.contains(closure)).toMatchInlineSnapshot(`true`)
  expect(heap1.size()).toMatchInlineSnapshot(`2`)
  expect(heap1.getHeap()).toMatchInlineSnapshot(`
    Set {
      Array [
        0,
      ],
      [Function],
    }
  `)

  const heap2 = new Heap()
  expect(heap1.move(mockClosure(true), heap2)).toMatchInlineSnapshot(`false`)
  expect(heap1.move(arr, heap2)).toMatchInlineSnapshot(`true`)
  expect(heap1.contains(arr)).toMatchInlineSnapshot(`false`)
  expect(heap1.getHeap()).toMatchInlineSnapshot(`
    Set {
      [Function],
    }
  `)
  expect(heap2.contains(arr)).toMatchInlineSnapshot(`true`)
  expect(heap2.getHeap()).toMatchInlineSnapshot(`
    Set {
      Array [
        0,
      ],
    }
  `)
})

const expectEnvTreeFrom = (code: string, hasPrelude = true) => {
  const context = mockContext(Chapter.SOURCE_4)
  if (!hasPrelude) context.prelude = null

  return expect(
    runCodeInSource(code, context, {
      executionMethod: 'cse-machine'
    }).then(() => context.runtime.environmentTree)
  ).resolves
}

test('Pre-defined functions are correctly added to prelude heap', () => {
  expectEnvTreeFrom('0;').toMatchSnapshot()
})

test('Arrays and closures are correctly added to their respective heaps', () => {
  expectEnvTreeFrom(
    stripIndent`
    function f(x) {
      return [10, 11, 12];
    }
    {
      const a = [1, 2, 3];
    }
    const b = [4, 5, 6];
    f([7, 8, 9]);
    `,
    false
  ).toMatchSnapshot()
})

test('Arrays created from built-in functions are correctly added to their respective heaps', () => {
  expectEnvTreeFrom(
    stripIndent`
    pair(1, 2);
    {
      list(1, 2, 3);
    }
    `
  ).toMatchSnapshot()
})

test('Variadic closures correctly add argument array to the function environment heap', () => {
  expectEnvTreeFrom(
    stripIndent`
    const f = (...x) => x;
    f(1, 2, 3);
    `,
    false
  ).toMatchSnapshot()
})

test('apply_in_underlying_javascript works correctly and adds objects to heaps', () => {
  expectEnvTreeFrom(
    stripIndent`
    let a = 0;
    function f(x) {
      a = [1];
      return x => x;
    }
    apply_in_underlying_javascript(f, list(0));
    `
  ).toMatchSnapshot()
})
