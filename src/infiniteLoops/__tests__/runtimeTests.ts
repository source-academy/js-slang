/* tslint:disable:max-line-length */
import { expectParsedError, expectResult } from '../../utils/testing'

test('no infinite loops detected', () => {
  const code = `
          function fib(x) {
              if (x===0 || x===1) {
                  return 1;
              } else {
                  return fib(x-1) + fib(x-2);
              }
          }
          fib(4);
      `
  return expectResult(code).toMatchSnapshot()
})

test('infinite loop detected fib function', () => {
  const code = `
          function fib(x) {
              if (x===0 || x===1) {
                  return 1;
              } else {
                  return fib(x-1) + fib(x-2);
              }
          }
          fib(-1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected no base case', () => {
  const code = `
          function fib(x) {
              return fib(x-1) + fib(x-2);
          }
          fib(1);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop detected no state change', () => {
  const code = `
        function fib(x) {
            if (x===0 || x===1) {
                return 1;
            } else {
                return fib(x);
            }
        }
        fib(5);
      `
  return expectParsedError(code).toMatchSnapshot()
})

test('infinite loop state change with conditionals terminates', () => {
    const works = `
          function f(x) {
            return x<0 || x>5? 0:f(x);
          }
          f(6);
        `
    return expectResult(works).toMatchSnapshot()
  })


test('infinite loop state change with conditionals detected', () => {
    const breaks = `
        function f(x) {
          return x<0 || x>5? 0:f(x);
        }
        f(2);
      `
    return expectParsedError(breaks).toMatchSnapshot()
  })
