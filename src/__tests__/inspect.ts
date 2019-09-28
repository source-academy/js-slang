/* tslint:disable:max-line-length */
import { parseError, resume, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { setBreakpointAtLine } from '../stdlib/inspector'
import { Result } from '../types'

test('debugger; statement basic test', () => {
  const code1 = `
  let a = 2;
  debugger;
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; statement in function', () => {
  const code1 = `
  function a(x){
    debugger;
    return x;
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; statement execution sequence', () => {
  const code1 = `
  function a(x){
    return x;
    debugger;
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; statement test function scope', () => {
  const code1 = `
  function a(x){
    let b = 10 * x;
    let c = 20 * x;
    let d = 30 * x;
    let e = d * b;
    let f = c * d;
    let g = 10 * c;
    let h = g + d;
    let i = g / 3;
    let j = f / b;
    let k = b / e;
    let l = b / c;
    debugger;
    return x;
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; statement hoisting', () => {
  const code1 = `
  function a(x){
    debugger;
    let z = 20;
    let c = z * x;
    let b = 123095;
    return x;
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; pauses for', () => {
  const code1 = `
  function a(x){
    for (let i=0; i<x; i=i+1){
      debugger;
    }
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('debugger; pauses while', () => {
  const code1 = `
  function a(x){
    while(x > 1){
      debugger;
      x=x-1;
    }
  }
  a(10);
  `
  const context = mockContext(3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

/* Breakpoints by line
 * The frontend editor sets breakpoints through this, results might differ
 * with debugger; statements. It is supposed to stop right at the start of the
 * line. You can't put breakpoints in the middle of statements.  For example
 * math_pow(10, *break* 4); It is possible but undefined.
 */

test('setBreakpointAtLine basic', () => {
  const code1 = `
  const a = 10;
  const b = 20;
  `
  const context = mockContext(3)
  setBreakpointAtLine(['helloworld'])
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('setBreakpointAtLine function 1', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a(10);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[1] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('setBreakpointAtLine function 2', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a("bob");
  `
  const context = mockContext(3)
  const breakline = []
  breakline[2] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('setBreakpointAtLine function 3', () => {
  // this code will never break because the breakpoint is at a bracket which
  // will never be evaluated.
  const code1 = `
  function a(x){
    return x + x;
  }
  a(20);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[3] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('setBreakpointAtLine function 4', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a(123345898);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[4] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('setBreakpointAtLine granularity 1', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[2] = 'a'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(obj2).toMatchSnapshot()
    })
  })
})

test('setBreakpointAtLine granularity 2', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[3] = 'a'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

test('setBreakpointAtLine granularity 3', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(3)
  const breakline = []
  breakline[4] = 'a'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

test('setBreakpointAtLine for loops', () => {
  // test stuff in loops work fine
  const code1 = `
  for(let i=1;i<10;i=i*2) {
    const b = i;
  }
  `
  const context = mockContext(3)
  const breakline = []
  breakline[2] = '2'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

test('setBreakpointAtLine while loops', () => {
  // test stuff in loops work fine
  const code1 = `
  let a = 9;
  while (a > 3){
    a = a - 3;
  }
  `
  const context = mockContext(3)
  const breakline = []
  breakline[3] = '3'
  setBreakpointAtLine(breakline)
  // for some reason this is safe from the breaking twice problem
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('suspended')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})
