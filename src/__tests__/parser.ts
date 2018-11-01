import { mockContext } from '../mocks/context'
import { parse } from '../parser'
import { runInContext } from '../index'

test('Empty parse returns empty Program Node', () => {
  const context = mockContext()
  const program = parse('', context)
  expect(program).toMatchSnapshot()
})

test('Parse a single string', () => {
  const context = mockContext()
  const program = parse("'42';", context)
  expect(program).toMatchSnapshot()
})

test('Parse a single number', () => {
  const context = mockContext()
  const program = parse('42;', context)
  expect(program).toMatchSnapshot()
})

test('Parse an arrow function', () => {
  const context = mockContext()
  const program = parse('x => x + 1;', context)
  expect(program).toMatchSnapshot()
})

test('Parse an arrow function expression in js-slang', () => {
  const code = 'stringify(parse("x => x + 1;"));'
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parse an arrow function assignment in js-slang', () => {
  const code = 'stringify(parse("const y = x => x + 1;"));'
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})
