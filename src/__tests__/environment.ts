import { Program } from 'estree'

import { evaluateProgram as evaluate } from '../interpreter/interpreter'
import { mockContext } from '../mocks/context'
import { parse } from '../parser/parser'
import { Chapter } from '../types'
import { stripIndent } from '../utils/formatters'

test('Function params and body identifiers are in different environment', () => {
  const code = stripIndent`
  function f(x) {
    const y = 1;
    // 13 steps to evaluate until here
    return x;
  }
  f(2);
  `
  const context = mockContext(Chapter.SOURCE_4)
  context.prelude = null // hide the unneeded prelude
  const parsed = parse(code, context)
  const it = evaluate(parsed as any as Program, context, false, false)
  const stepsToComment = 13 // manually counted magic number
  for (let i = 0; i < stepsToComment; i += 1) {
    it.next()
  }
  context.runtime.environments.forEach(environment => {
    expect(environment).toMatchSnapshot({
      id: expect.any(String)
    })
  })
  expect(context.runtime.environments[0].head).toMatchObject({ y: 1 })
})
