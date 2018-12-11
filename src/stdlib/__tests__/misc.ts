import { mockContext } from '../../mocks/context'
import { parseError, runInContext } from '../../index'
import { Finished } from '../../types'

test('parse_int with valid args is ok, radix 2', () => {
  const program = `
    parse_int('1100101010101', 2);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(parseInt('1100101010101', 2))
  })
})

test('parse_int with valid args is ok, radix 36', () => {
  const program = `
    parse_int('uu1', 36);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(parseInt('uu1', 36))
  })
})

test('parse_int with valid args is ok, but invalid str for radix', () => {
  const program = `
    parse_int('uu1', 2);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(parseInt('uu1', 2))
  })
})

test('parse_int with non-string arg str throws error', () => {
  const program = `
    parse_int(42, 2);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('parse_int with non-integer arg radix throws error', () => {
  const program = `
    parse_int(42, 2.1);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('parse_int with radix outside [2, 36] throws error, radix=1', () => {
  const program = `
    parse_int('10', 1);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('parse_int with radix outside [2, 36] throws error, radix=37', () => {
  const program = `
    parse_int('10', 37);
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('parse_int with string arg radix throws error', () => {
  const program = `
    parse_int(42, '2');
  `
  const context = mockContext()
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})
