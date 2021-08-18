import { testForInfiniteLoop } from '../runtime'
import { getInfiniteLoopData, InfiniteLoopError, InfiniteLoopErrorType } from '../errors'
import { mockContext } from '../../mocks/context'
import { runInContext } from '../..'

test('works in runInContext when throwInfiniteLoops is true', async () => {
  const code = `function fib(x) {
    return fib(x-1) + fib(x-2);
  }
  fib(100000);`
  const context = mockContext(4)
  await runInContext(code, context, { throwInfiniteLoops: true })
  const lastError = context.errors[context.errors.length - 1]
  expect(lastError instanceof InfiniteLoopError).toBe(true)
  const result: InfiniteLoopError = lastError as InfiniteLoopError
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.NoBaseCase)
  expect(result?.streamMode).toBe(false)
})

test('works in runInContext when throwInfiniteLoops is false', async () => {
  const code = `function fib(x) {
    return fib(x-1) + fib(x-2);
  }
  fib(100000);`
  const context = mockContext(4)
  await runInContext(code, context, { throwInfiniteLoops: false })
  const lastError: any = context.errors[context.errors.length - 1]
  expect(lastError instanceof InfiniteLoopError).toBe(false)
  const result = getInfiniteLoopData(context)
  expect(result).toBeDefined()
  expect(result?.[0]).toBe(InfiniteLoopErrorType.NoBaseCase)
  expect(result?.[1]).toBe(false)
})

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

test('detect mutual recursion', () => {
  const code = `function e(x){
    return x===0?1:1-o(x-1);
    }
    function o(x){
        return x===1?0:1-e(x-1);
    }
    e(9);`
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.FromSmt)
  expect(result?.streamMode).toBe(false)
})

test('functions passed as arguments not checked', () => {
  // if they are checked -> this will throw no base case
  const code = `const twice = f => x => f(f(x));
  const thrice = f => x => f(f(f(x)));
  const add = x => x + 1;
  
  (thrice)(twice(twice))(twice(add))(0);`
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})

test('detect complicated cycle example', () => {
  const code = `function permutations(s) {
    return is_null(s)
    ? list(null)
    : accumulate(append, null,
    map(x => map(p => pair(x, p),
    permutations(remove(x, s))),
    s));
   }
   
   function remove_duplicate(xs) {
     return is_null(xs)
       ? xs
       : pair(head(xs),
         remove_duplicate(filter(x => x !== equal(head(xs),x), xs)));
   }
   
   remove_duplicate(list(list(1,2,3), list(1,2,3)));
   `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
})

test('detect complicated cycle example 2', () => {
  const code = `function make_big_int_from_number(num){
    let output = num;
    while(output !== 0){
        const digits = num % 10;
        output = math_floor(num / 10);
        
    }
}
make_big_int_from_number(1234);
   `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.Cycle)
  expect(result?.streamMode).toBe(false)
})

test('detect complicated fromSMT example', () => {
  const code = `function super_bunny(n){
    function helper(total_steps_left, steps_available) {
        if (total_steps_left < 0 || steps_available === 0) {
            return 0;
        } else if (total_steps_left === 1) {
            return 1;
        } else {
            return 1 + helper(total_steps_left-1, steps_available-1)
             + helper(5, steps_available-3);
        }
    }
    return helper(n, n);
  }
  super_bunny(5);
   `
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.FromSmt)
  expect(result?.streamMode).toBe(false)
})

test('detect complicated fromSMT example 2', () => {
  const code = `function fast_power(b,n){
    if (n % 2 === 0){
        return b* fast_power(b, n-2);
    } else { 
        return b * fast_power(b, n-2);
    }

  }
  fast_power(2,3);`
  const result = testForInfiniteLoop(code, [])
  expect(result?.infiniteLoopType).toBe(InfiniteLoopErrorType.FromSmt)
  expect(result?.streamMode).toBe(false)
})

test('detect complicated stream example', () => {
  const code = `function up(a, b) {
    return (a > b)
            ? up(1, 1 + b)
            : pair(a, () => stream_reverse(up(a + 1, b)));
  }
  eval_stream(up(1,1), 22);`
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeDefined()
  expect(result?.streamMode).toBe(true)
})

test('math functions are disabled in smt solver', () => {
  const code = `
  function f(x) {
    return x===1 ? x: f(math_floor(x));
  }
  f(2);`
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})

test('math functions are disabled', () => {
  const code = `
  function cc(n) {
    return n===0
        ? "hi"
        : n % 2 === 0
        ? cc(math_floor(n/2))
        : cc(n*3+1);
}

cc(99);`
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})

test('cycle detection ignores non deterministic functions', () => {
  const code = `
  function f(x) {
    return x===0?0:f(math_floor(math_random()/2) + 1);
  }
  f(1);`
  const result = testForInfiniteLoop(code, [])
  expect(result).toBeUndefined()
})
