import { Program } from 'estree'

import { mockContext } from '../utils/testing/mocks'
import { parse } from '../parser/parser'
import { Chapter } from '../types'
import { stripIndent } from '../utils/formatters'
import { evaluate } from '../cse-machine/interpreter'
import { DEFAULT_SOURCE_OPTIONS } from '../runner'

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
  const it = evaluate(parsed as any as Program, context, DEFAULT_SOURCE_OPTIONS)
  const stepsToComment = 13 // manually counted magic number
  for (let i = 0; i < stepsToComment; i += 1) {
    it.next()
  }
  context.runtime.environments.forEach(environment => {
    expect(environment).toMatchSnapshot()
  })
  expect(context.runtime.environments[0].head).toMatchObject({ y: 1 })
})
