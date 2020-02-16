import { stripIndent } from '../utils/formatters'
import { expectResult } from '../utils/testing'

test('pair', () => {
  return expectResult('pair(1, 2);').toBe([1, [Function]])
})

test('list', () => {
  return expectResult('list(1, 2);').toBe([1, [Function]])
})

test('is_list', () => {
  return expectResult('!is_list(1)&&is_list(list(1,2))&&!is_list(pair(1,2));').toBe(true)
})

test('is_pair', () => {
  return expectResult('!is_pair(1)&&is_pair(pair(1,2))&&is_pair(list(1,2));').toBe(true)
})

test('head_and_pair', () => {
  return expectResult('head(pair(8,2))===tail(pair(3,8));').toBe(true)
})

test('tail_list', () => {
  return expectResult('tail(list(1,2));').toBe([2, [Function]])
})

test('tail_tail_list', () => {
  return expectResult('tail(tail(list(1,2)));').toBe(null)
})

test('tail_list_list', () => {
  return expectResult('tail(list(1,list(2,3)));').toBe([2, [Function]])
})

test('head_null', () => {
  return expectResult('head(null);').toBe(undefined)
})

test('tail_null', () => {
  return expectResult('tail(null);').toBe(undefined)
})

test('head_number', () => {
  return expectResult('head(1);').toBe(undefined)
})

test('tail_number', () => {
  return expectResult('tail(1);').toBe(undefined)
})

test('length', () => {
  return expectResult('length(list(1,2,3,4));').toBe(4)
})

test('length of tail list', () => {
  return expectResult('length(list(1,list(2,3)));').toBe(3)
})

test('Infinite stream', () => {
  return expectResult(
    stripIndent`
      function fibgen(a, b) {return pair(a, fibgen(b, a + b));}
      list_ref(fibgen(0, 1),8);
    `,
    { chapter: 4, native: true }
  ).toBe(21)
})

test('Infinite stream and filter', () => {
  return expectResult(
    stripIndent`
      function integer(a) {return pair(a, integer(a+1));}
      function isPrime(a){
        const limit = math_floor(sqrt(a));
        let i = 2;
        while (i<=limit){
          if (a % i ===0){return false;}
          else{ i= i+1;}
        }
        return true;
      }
      const ints = integer(2);
      list_ref(filter(isPrime,fibs), 7);
    `,
    { chapter: 4, native: true }
  ).toBe(17)
})
