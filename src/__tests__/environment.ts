import { parse } from '../parser'
import { stripIndent } from 'common-tags'
import { Program } from 'estree'
import { evaluate } from '../interpreter'
import { mockContext } from '../mocks/context'

test('Function params and body identifiers are in the same environment', () => {
  const code = stripIndent`
  function f(x) {
    const y = 1;
    // 13 steps to evaluate until here
    return x;
  }
  f(2);
  `
  const context = mockContext(4)
  const parsed = parse(code, context)
  const it = evaluate((parsed as any) as Program, context)
  const stepsToComment = 13 // manually counted magic number
  for (let i = 0; i < stepsToComment; i += 1) {
    it.next()
  }
  expect(context.runtime.environments).toMatchSnapshot()
  expect(context.runtime.environments[0].head).toMatchObject({ x: 2, y: 1 })
})
