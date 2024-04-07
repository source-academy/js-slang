import { mockClosure, mockContext } from '../../mocks/context'
import { runCodeInSource } from '../../runner'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import Heap from '../heap'
import type { Array } from '../types'

test('Heap works correctly', () => {
  const heap = new Heap()
  expect(heap.size()).toMatchInlineSnapshot(`0`)
  expect(heap.getHeap()).toMatchInlineSnapshot(`Set {}`)

  const arr = [0] as Array
  heap.add(arr)
  expect(heap.contains([0] as Array)).toMatchInlineSnapshot(`false`)
  expect(heap.contains(arr)).toMatchInlineSnapshot(`true`)
  heap.add(arr)
  expect(heap.size()).toMatchInlineSnapshot(`1`)
  expect(heap.getHeap()).toMatchInlineSnapshot(`
    Set {
      Array [
        0,
      ],
    }
  `)

  const closure = mockClosure()
  heap.add(closure)
  expect(heap.contains(closure)).toMatchInlineSnapshot(`true`)
  expect(heap.size()).toMatchInlineSnapshot(`2`)
  expect(heap.getHeap()).toMatchInlineSnapshot(`
    Set {
      Array [
        0,
      ],
      [Function],
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

test('Pre-defined functions are correctly added to prelude environment heap', () => {
  expectEnvTreeFrom('0;').toMatchSnapshot()
})

test('Arrays and closures are correctly added to their respective environment heaps', () => {
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

test('Arrays created from in-built functions are correctly added to the environment heap', () => {
  expectEnvTreeFrom(
    stripIndent`
    pair(1, 2);
    {
      list(1, 2, 3);
    }
    `
  ).toMatchSnapshot()
})
