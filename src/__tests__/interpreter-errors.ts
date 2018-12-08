import { mockContext } from '../mocks/context'
import { runInContext, parseError } from '../index'

test('Undefined variable error is thrown', () => {
  const code = `
    im_undefined;
  `
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Name im_undefined not declared')
  })
})

test('Error when assigning to builtin', () => {
  const code = `
    map = 5;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign new value to constant map')
  })
})

test('Error when assigning to builtin', () => {
  const code = `
    undefined = 5;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign new value to constant undefined')
  })
})

test('Error when assigning to property on undefined', () => {
  const code = `
    undefined['prop'] = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign property prop of undefined')
  })
})

test('Error when assigning to property on variable with value undefined', () => {
  const code = `
    const u = undefined;
    u['prop'] = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot assign property prop of undefined')
  })
})

test('Error when deeply assigning to property on variable with value undefined', () => {
  const code = `
    const u = undefined;
    u['prop']['prop'] = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot read property prop of undefined')
  })
})

test('Error when accessing property on undefined', () => {
  const code = `
    undefined['prop'];
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot read property prop of undefined')
  })
})

test('Error when deeply accessing property on undefined', () => {
  const code = `
    undefined['prop']['prop'];
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot read property prop of undefined')
  })
})

test('In case a function ever returns null, should throw an error as well', () => {
  const code = `
    const myNull = pair['constructor']("return null;")();
    myNull['prop'];
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot read property prop of null')
  })
})
