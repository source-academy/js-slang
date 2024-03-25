import { mockClosure, mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { sourceRunner } from '../../runner'
import Heap from '../heap'
import { Array } from '../types'

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

test('Environment heap correctly stores all arrays and closures', async () => {
  const code = stripIndent`
  function f(x) {
    return x;
  }
  {
    const a = [1, 2, 3];
  }
  const b = [4, 5, 6];
  `
  const context = mockContext(Chapter.SOURCE_4)
  context.prelude = null // hide the unneeded prelude
  const parsed = parse(code, context)
  await sourceRunner(parsed!, context, false, { executionMethod: 'cse-machine' })
  expect(context.runtime.environmentTree).toMatchSnapshot()
  // program environment heap should only contain 2 items
  expect(context.runtime.environments[0].heap.size()).toMatchInlineSnapshot(`2`)
  // block environment heap should only contain 1 item
  expect(
    context.runtime.environmentTree.root!.children[0].children[0].environment.heap.size()
  ).toMatchInlineSnapshot(`1`)
})
