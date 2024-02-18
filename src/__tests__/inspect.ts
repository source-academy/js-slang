/* tslint:disable:max-line-length */
import { parseError, resume, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { setBreakpointAtLine } from '../stdlib/inspector'
import { Chapter, Environment, Result } from '../types'

// we need to tame the environments for snapshotting,
// so we remove the tail part that is a copy of the previous environment
// and we remove the first global environment
function flattenEnvironments(result: Result): Environment[] {
  return (result as any)
    .context!.runtime.environments.slice(0, -1)
    .map((env: Environment) => ({ ...env, tail: null }))
}

// Test suite skipped since functionality of debugger statements
// has been changed for environment visualiser.
xtest('debugger; statement basic test', () => {
  const code1 = `
  let a = 2;
  debugger;
  `
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; statement in function', () => {
  const code1 = `
  function a(x){
    debugger;
    return x;
  }
  a(10);
  `
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; statement execution sequence', () => {
  const code1 = `
  function a(x){
    return x;
    debugger;
  }
  a(10);
  `
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; statement test function scope', () => {
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
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; statement hoisting', () => {
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
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; pauses for', () => {
  const code1 = `
  function a(x){
    for (let i=0; i<x; i=i+1){
      debugger;
    }
  }
  a(10);
  `
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('debugger; pauses while', () => {
  const code1 = `
  function a(x){
    while(x > 1){
      debugger;
      x=x-1;
    }
  }
  a(10);
  `
  const context = mockContext(Chapter.SOURCE_3)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

/* Breakpoints by line
 * The frontend editor sets breakpoints through this, results might differ
 * with debugger; statements. For all intents and purposes the correctness is:
 * - whatever your little heart desires!
 * - debugger;
 * - setBreakpointAtLine
 * So if anything goes wrong with this, default to your mental model or the
 * behavior of the debugger; statement.
 */

xtest('setBreakpointAtLine basic', () => {
  const code1 = `
  const a = 10;
  const b = 20;
  `
  const context = mockContext(Chapter.SOURCE_3)
  setBreakpointAtLine(['helloworld'])
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('setBreakpointAtLine function 1', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a(10);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[1] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('setBreakpointAtLine function 2', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a("bob");
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[2] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('setBreakpointAtLine function 3', () => {
  // this code will never break because the breakpoint is at a bracket which
  // will never be evaluated.
  const code1 = `
  function a(x){
    return x + x;
  }
  a(20);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[3] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('setBreakpointAtLine function 4', () => {
  const code1 = `
  function a(x){
    return x + x;
  }
  a(123345898);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[4] = 'asd'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

xtest('setBreakpointAtLine granularity 1', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[2] = 'a'
  setBreakpointAtLine(breakline)
  // right now for some reason it breaks twice at the line.
  // this should not happen
  // if you do fix this issue, this is good to modify.
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      return (resume(obj2) as Promise<Result>).then(obj3 => {
        expect(flattenEnvironments(obj3)).toMatchSnapshot()
        expect(obj3.status).toBe('suspended-cse-eval')
        expect(parseError(context.errors)).toMatchSnapshot()
      })
    })
  })
})

xtest('setBreakpointAtLine granularity 2', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[3] = 'a'
  setBreakpointAtLine(breakline)
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(flattenEnvironments(obj2)).toMatchSnapshot()
      expect(obj2.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

xtest('setBreakpointAtLine granularity 3', () => {
  // this tests that we can indeed stop at individual lines
  const code1 = `
  function a(ctrlf){
    return ctrlf < 0 ?
    0 :
    a(ctrlf - 1);
  }
  a(1);
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[4] = 'a'
  setBreakpointAtLine(breakline)
  // for some reason this is safe from the breaking twice problem
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(flattenEnvironments(obj2)).toMatchSnapshot()
      expect(obj2.status).toBe('suspended-cse-eval')
      expect(parseError(context.errors)).toMatchSnapshot()
      return (resume(obj2) as Promise<Result>).then(obj3 => {
        expect(flattenEnvironments(obj3)).toMatchSnapshot()
        expect(obj3.status).toBe('finished')
        expect(parseError(context.errors)).toMatchSnapshot()
      })
    })
  })
})

xtest('setBreakpointAtLine for loops', () => {
  // test stuff in loops work fine
  const code1 = `
  for(let i=1;i<10;i=i*2) {
    const b = i;
  }
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[2] = '2'
  setBreakpointAtLine(breakline)
  // for some reason this is safe from the breaking twice problem
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(flattenEnvironments(obj2)).toMatchSnapshot()
      expect(obj2.status).toBe('suspended-cse-eval')
      expect(parseError(context.errors)).toMatchSnapshot()
      return (resume(obj2) as Promise<Result>).then(obj3 => {
        expect(flattenEnvironments(obj3)).toMatchSnapshot()
        expect(obj3.status).toBe('suspended-cse-eval')
        expect(parseError(context.errors)).toMatchSnapshot()
        return (resume(obj3) as Promise<Result>).then(obj4 => {
          expect(flattenEnvironments(obj4)).toMatchSnapshot()
          expect(obj4.status).toBe('suspended-cse-eval')
          expect(parseError(context.errors)).toMatchSnapshot()
          return (resume(obj4) as Promise<Result>).then(obj5 => {
            expect(flattenEnvironments(obj5)).toMatchSnapshot()
            expect(obj5.status).toBe('finished')
            expect(parseError(context.errors)).toMatchSnapshot()
          })
        })
      })
    })
  })
})

xtest('setBreakpointAtLine while loops', () => {
  // test stuff in loops work fine
  const code1 = `
  let a = 9;
  while (a > 3){
    a = a - 3;
  }
  `
  const context = mockContext(Chapter.SOURCE_3)
  const breakline = []
  breakline[3] = '3'
  setBreakpointAtLine(breakline)
  // for some reason this is safe from the breaking twice problem
  return runInContext(code1, context, {
    scheduler: 'preemptive',
    executionMethod: 'auto'
  }).then(obj1 => {
    flattenEnvironments(obj1).forEach(environment => {
      expect(environment).toMatchSnapshot({
        id: expect.any(String)
      })
    })
    expect(obj1.status).toBe('suspended-cse-eval')
    expect(parseError(context.errors)).toMatchSnapshot()
    return (resume(obj1) as Promise<Result>).then(obj2 => {
      expect(flattenEnvironments(obj2)).toMatchSnapshot()
      expect(obj2.status).toBe('suspended-cse-eval')
      expect(parseError(context.errors)).toMatchSnapshot()
      return (resume(obj2) as Promise<Result>).then(obj5 => {
        expect(flattenEnvironments(obj5)).toMatchSnapshot()
        expect(obj5.status).toBe('finished')
        expect(parseError(context.errors)).toMatchSnapshot()
      })
    })
  })
})
