/* tslint:disable:max-line-length */
import { expectParsedError, expectResult } from '../../utils/testing'

// More test cases https://tinyurl.com/source-infloops
// Look under UNSUPPORTED for infinite loops that cannot
// be detected yet

test('scoping/shadowing does not cause false positives', () => {
  const code = `
  function f() {
    const f = () => 1;
    return f();
  }
  f();
      `
  return expectResult(code).toMatchSnapshot()
})

test('returning early does not cause false positives', () => {
  const code = `
  function f() {
    return 1;
    f();
  }
  f();
      `
  return expectResult(code).toMatchSnapshot()
})

test('CallingNonFunctionValue does not break implementation', () => {
  const code = `
  function f(x) {
    return 1(2);
  }
  f(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('CallingNonFunctionValue does not break implementation', () => {
  const code = `
  function f(x) {
    return 1(2);
  }
  f(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('InvalidNumberOfArguments does not break implementation', () => {
  const code = `
  function f(x) {
    return f() + f(1,2);
  }
  f(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: countdown fac', () => {
  const code = `
  function CD_fac(x) {
    if (x===0) {
        return 1;
    } else {
        return x*CD_fac(x-1);
    }
  }
  CD_fac(-1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: countdown fac 2', () => {
  const code = `
  function CD_fac_2(x) {
    if (x===0) {
        return 1;
    } else {
        return x*CD_fac_2(x-2);
    }
  }
  CD_fac_2(5);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: countdown fac cond', () => {
  const code = `
  function CD_fac_cond(x) {
    return x===0?1:x*CD_fac_cond(x-1);
  }
  CD_fac_cond(-1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: countdown fac log', () => {
  const code = `
  function CD_fac_log(x,s) {
    if (x===0) {
        //display(s);
        return 1;
    } else {
         x*CD_fac_log(x-1,"multiply by "+stringify(x)+"; "+s);
    }
  }
  CD_fac_log(-1,"");
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: countdown fib', () => {
  const code = `
  function CD_fib(x) {
    if (x===0) {
        return 1;
    } else {
        return CD_fib(x-1) + CD_fib(x-2);
    }
  }
  CD_fib(-1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: unreachable condition fib', () => {
  const code = `
  function UC_fac(x) {
    if (!(x!==0||x!==1)) {
        return 1;
    } else {
        return x*UC_fac(x-1);
    }
  }
  UC_fac(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no base case fac', () => {
  const code = `
  function NBC_fac(x) {
    return x*NBC_fac(x-1);
  }
  NBC_fac(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no base case fac log', () => {
  const code = `
  function NBC_fac_log(x,s) {
    return x*NBC_fac_log(x-1,"multiply by "+stringify(x)+"; "+s);
  }
  NBC_fac_log(1,"");
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no base case fib', () => {
  const code = `
  function NBC_fib(x) {
    return NBC_fib(x-1) + NBC_fib(x-2);
  }
  NBC_fib(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change fac', () => {
  const code = `
  function NSC_fac(x) {
    if (x===0) {
        return 1;
    } else {
        return x*NSC_fac(x);
    }
  }
  NSC_fac(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change fac cond', () => {
  const code = `
  function NSC_fac_cond(x) {
    return x===0?1:x*NSC_fac_cond(x);
  }
  NSC_fac_cond(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change fac log', () => {
  const code = `
  function NSC_fac_log(x,s) {
    if (x===0) {
        //display(s);
        return 1;
    } else {
         x*NSC_fac_log(x,"multiply by "+stringify(x)+"; "+s);
    }
  }
  NSC_fac_log(1, "");
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change fib', () => {
  const code = `
  function NSC_fib(x) {
    if (x===0) {
        return 1;
    } else {
        return NSC_fib(x) + NSC_fib(x);
    }
  }
  NSC_fib(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change sum', () => {
  const code = `
  function NSC_sum(x){
    if(is_null(x)){
        return 0;
    } else {
        return head(x)+NSC_sum(x);
    }
  }
  NSC_sum(list(1,2));

      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected: no state change sum', () => {
  const code = `
  function NBC_sum(x){
    return head(x)+NBC_sum(tail(x));
  }
  NBC_sum(list(1,2)); //terminates (error)
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loops not detected', () => {
  const code = `
  function NSC_fac(x) {
    if (x===0) {
        return 1;
    } else {
        return x*NSC_fac(x);
    }
  }
  NSC_fac(0); //terminates

  function NSC_fac_cond(x) {
    return x===0?1:x*NSC_fac_cond(x);
  }
  NSC_fac_cond(0); //terminates

  function NSC_fac_log(x,s) {
    if (x===0) {
        display(s);
        return 1;
    } else {
         x*NSC_fac_log(x,"multiply by "+stringify(x)+"; "+s);
    }
  }
  NSC_fac_log(0, ""); //terminates

  function NSC_fib(x) {
    if (x===0) {
        return 1;
    } else {
        return NSC_fib(x) + NSC_fib(x);
    }
  }
  NSC_fib(0); //terminates

  function NSC_sum(x){
    if(is_null(x)){
        return 0;
    } else {
        return head(x)+NSC_sum(x);
    }
  }
  NSC_sum(null); //terminates

  function sum(x){
    if(is_null(x)){
        return 0;
    } else {
        return head(x)+sum(tail(x));
    }
  }
  sum(list(1,2,3)); // sum always terminates
      `
  return expectResult(code, { chapter: 2 }).toMatchSnapshot()
})
