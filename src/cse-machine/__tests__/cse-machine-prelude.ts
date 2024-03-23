import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Finished } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { sourceRunner } from '../../runner'

test('Prelude runs correctly in the CSE Machine', async () => {
  const code = stripIndent`
  equal(0, 0);
  parse('0;');
  `
  const context = mockContext(Chapter.SOURCE_4)
  const parsed = parse(code, context)
  const result = await sourceRunner(parsed!, context, false, { executionMethod: 'cse-machine' })
  expect(result.status).toMatchInlineSnapshot(`"finished"`)
  expect((result as Finished).value).toMatchInlineSnapshot(`
    Array [
      "literal",
      Array [
        0,
        null,
      ],
    ]
  `)
})

test("Context runtime's objectCount continues after prelude", async () => {
  const code = stripIndent`
  const a = list(1, 2, 3);
  `
  const context = mockContext(Chapter.SOURCE_4)
  const parsed = parse(code, context)
  await sourceRunner(parsed!, context, false, { executionMethod: 'cse-machine' })
  // 1 prelude environment + 45 prelude closures, so program environment has id of '46'
  expect(context.runtime.environments[0].id).toMatchInlineSnapshot(`"46"`)
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`47`)
})
