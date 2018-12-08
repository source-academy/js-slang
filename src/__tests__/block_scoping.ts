import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'

// This is bad practice. Don't do this!
test('standalone block statements', () => {
  const code = `
    function test(){
      const x = true;
      {
          const x = false;
      }
      return x;
    }
    test();
  `
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

// This is bad practice. Don't do this!
test('const uses block scoping instead of function scoping', () => {
  const code = `
    function test(){
      const x = true;
      if(true) {
          const x = false;
      } else {
          const x = false;
      }
      return x;
    }
    test();
  `
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

// This is bad practice. Don't do this!
test('let uses block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      if(true) {
          let x = false;
      } else {
          let x = false;
      }
      return x;
    }
    test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

// This is bad practice. Don't do this!
test('for loops use block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      for (let x = 1; x > 0; x = x - 1) {
      }
      return x;
    }
    test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    //expect(obj.status).toBe("finished");
    expect(parseError(context.errors)).toBe('')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)

  })
})

// This is bad practice. Don't do this!
test('while loops use block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      while (true) {
        let x = false;
        break;
      }
      return x;
    }
    test();
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

//see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
//and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
test('for loop `let` variables are copied into the block scope', () => {
  const code = `
  function test(){
    let z = [];
    for (let x = 0; x < 2; x = x + 1) {
      z[x] = () => x;
    }
    return z[1]();
  }
  test();
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(1)
    expect(obj).toMatchSnapshot()
  })
})

test('Cannot overwrite loop variables within a block', () => {
  const code = `
  function test(){
      let z = [];
      for (let x = 0; x < 2; x = x + 1) {
        x = 1;
      }
      return false;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test(
  'No hoisting of functions. Only the name is hoisted like let and const',
  () => {
    const code = `
      const v = f();
      function f() {
        return 1;
      }
      v;
    `
    const context = mockContext()
    const promise = runInContext(code, context, {scheduler: 'preemptive'})
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(obj).toMatchSnapshot()
      expect(obj.status).toBe('error')
      expect(errors).toEqual(
        expect.stringMatching(/^Line 2: Name f not yet assigned/)
      )
    })
  },
  30000
)

test(
  'In a block, every going-to-be-defined variable in the block cannot be accessed until it has been defined in the block.',
  () => {
    const code = `
      const a = 1;
      {
        a + a;
        const a = 10;
      }
    `
    const context = mockContext()
    const promise = runInContext(code, context, {scheduler: 'preemptive'})
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toMatchSnapshot()
      expect(errors).toEqual(
        expect.stringMatching(/^Line 4: Name a not yet assigned/)
      )
    })
  },
  30000
)

test('Shadowed variables may not be assigned to until declared in the current scope', () => {
  const code = `
  let variable = 1;
  function test(){
    variable = 100;
    let variable = true;
    return variable;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(obj.status).toBe('error')
    expect(errors).toMatchSnapshot()
  })
})
