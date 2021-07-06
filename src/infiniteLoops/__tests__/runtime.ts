import { testForInfiniteLoop } from '../runtime'
import { InfiniteLoopErrorType } from '../detect'

test('non-infinite recursion not detected', () => {
  const code = `function fib(x) {
        return x<=1?x:fib(x-1) + fib(x-2);
    }
    fib(100000);
    `
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})

test('non-infinite loop not detected', () => {
  const code = `for(let i = 0;i<2000;i=i+1){i+1;}
    let j = 0;
    while(j<2000) {j=j+1;}
    `
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})

test('no base case function detected', () => {
  const code = `function fib(x) {
        return fib(x-1) + fib(x-2);
    }
    fib(100000);
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.NoBaseCase)
  expect(result?.streamMode).toBe(false)
})

test('no base case loop detected', () => {
  const code = `for(let i = 0;true;i=i+1){i+1;}
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.NoBaseCase)
  expect(result?.streamMode).toBe(false)
})

test('no variables changing function detected', () => {
  const code = `let x = 1;
    function f() {
        return x===0?x:f();
    }
    f();
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
  expect(result?.explain()).toContain('None of the variables are being updated.')
})

test('no state change function detected', () => {
  const code = `let x = 1;
    function f() {
        return x===0?x:f();
    }
    f();
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
  expect(result?.explain()).toContain('None of the variables are being updated.')
})

test('infinite cycle detected', () => {
  const code = `function f(x) {
        return x[0] === 1? x : f(x);
    }
    f([2,3,4]);
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
  expect(result?.explain()).toContain('cycle')
  expect(result?.explain()).toContain('[2,3,4]')
})

test('infinite data structures detected', () => {
  const code = `function f(x) {
        return is_null(x)? x : f(tail(x));
    }
    let circ = list(1,2,3);
    set_tail(tail(tail(circ)), circ);
    f(circ);
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
  expect(result?.explain()).toContain('cycle')
  expect(result?.explain()).toContain('(CIRCULAR)')
})

test('functions using SMT work', () => {
  const code = `function f(x) {
        return x===0? x: f(x+1);
    }
    f(1);
    `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.FromSmt)
  expect(result?.streamMode).toBe(false)
})

test('detect forcing infinite streams', () => {
  const code = `stream_to_list(integers_from(0));`
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.NoBaseCase)
  expect(result?.streamMode).toBe(true)
})
