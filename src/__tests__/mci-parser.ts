import { mockContext } from '../mocks/context'
//@ts-ignore
import { Parser } from '../stdlib/parser.js'

const parser = new Parser()

test('Parse an arrow function', () => {
  const context = mockContext()
  const program = parser.parse('x => x + 1;', context)
  expect(program).toMatchSnapshot()
})

test('Parse arrow function assignment', () => {
  const context = mockContext()
  const program = parser.parse('const y = x => x + 1;', context)
  expect(program).toMatchSnapshot()
})

