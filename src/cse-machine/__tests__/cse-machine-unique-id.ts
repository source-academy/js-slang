import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { sourceRunner } from '../../runner'

const getContextFrom = async (code: string) => {
  const context = mockContext(Chapter.SOURCE_4)
  const parsed = parse(code, context)
  await sourceRunner(parsed!, context, false, { executionMethod: 'cse-machine' })
  return context
}

test("Context runtime's objectCount continues after prelude", async () => {
  const context = await getContextFrom('const a = list(1, 2, 3);')
  // 1 prelude environment + 45 prelude closures in Source 4,
  // so program environment has id of '46'
  expect(context.runtime.environments[0].id).toMatchInlineSnapshot(`"46"`)
  // 1 program environment + 3 arrays from the list function, so final objectCount is 50
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`50`)
})

test('Every environment/array/closure has a unique id', async () => {
  const context = await getContextFrom(
    stripIndent`
      [1];
      const a = [2];
      const b = pair(3, null);
      function c(x) {}
      c(list(6, 7, 8));
      {
        const d = [9];
        [10];
        x => x;
      }
    `
  )
  expect(context.runtime.environmentTree).toMatchSnapshot()
  // Environments: 1 prelude + 1 program + 1 function (c) + 1 block, total: 4
  // Arrays: 4 arrays created manually + 4 arrays from in-built functions (pair, list), total: 8
  // Closures: 45 prelude closures + 1 program closure (c) + 1 block closure (e), total 47
  // Total count: 4 + 8 + 47 = 59
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`59`)
})
